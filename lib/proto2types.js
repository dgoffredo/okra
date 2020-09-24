define(['child_process', 'path', '../schemas/schemas'],
function (child_process, path, schemas) {
'use strict';

// Return an object containing a registry of options and list of objects
// satisfying `schemas/type.tisch.js` derived from running the protocol buffer
// compiler (`protoc`) in the specified manner. See the comments in the
// implementation for documentation of the properties of `options` and of the
// returned object.
function proto2types(options) {
    let {
        // protoFiles :: [<.proto file path>, ...]
        // These are the the paths to the protobuf schema files to compile.
        protoFiles,

        // rootTypes :: [<type name>, ...]
        // `proto2types` processes all message and enum types by default. To
        // restrict the set of types that are converted into database tables,
        // add fully-qualified type names to `rootTypes`. The types
        // `rootTypes` and their descendents will be processed exclusively.
        rootTypes,

        // protoIncludePaths :: [<path to directory>, ...]
        // These are the directories to search for depended-upon protobuf
        // schema files. The parent directories of the files in `protoFiles`
        // are automatically included.
        protoIncludePaths = [],

        // idFields :: {<type name>: <field name of object ID>}
        // Message types eventually become tables whose primary key
        // corresponds to the "id" field of the message type. `idFields`
        // allows you to specify a different field instead (e.g. if there is no
        // "id" field). The type names must be fully qualified, e.g. type "Foo"
        // in package "lol.wut" is "lol.wut.Foo" or, equivalently (for this
        // purpose), ".lol.wut.Foo".
        idFields = {}
    } = options;

    if (!Array.isArray(protoFiles)) {
        throw Error('Specify an array of .proto files to compile.');
    }

    // Execute the protoc compiler wrapper as a subprocess. It produces a JSON
    // object.
    const protoInfo = invokeProtocJson(protoIncludePaths, protoFiles);

    // Keep in mind that the protocol buffer plugin request schema adheres to
    // the (subsequently abandoned) convention of using singular nouns for
    // `repeated` fields (arrays). So, when you see `protoFile`, it's an array.
    // When you see `enumType` or `messageType`, it's an array.

    const protoOptionsByFile = Object.fromEntries(
        protoInfo.protoFile.map(file => [
            file.name,
            // `file.options` will have a "location" property, but it's not an
            // option, it's an artifact of `protojson`, so omit it.
            (function () {
                const options = {...file.options};
                delete options.location;
                return options;
            }())
        ]));

    // typesByName :: {<fully qualified name>: <type.tisch.js object>}
    const typesByName = protoInfo.protoFile.reduce((typesByName, file) => {
        const packageName = '.' + file.package;

        (file.messageType || [])
            // omit "built-in" messages (e.g. .google.protobuf.Timestamp)
            .filter(message => !builtinMessage(packageName + '.' + message.name))
            .map(message => message2type(
                {fileName: file.name, packageName, descriptor: message, idFields}))
            .forEach(type => typesByName[type.name] = type);

        (file.enumType || [])
            .map(anEnum => enum2type(
                {fileName: file.name, packageName, descriptor: anEnum}))
            .forEach(type => typesByName[type.name] = type);

        return typesByName;
    }, {});    

    // Identify the types that will be the roots of the tree of types to
    // generate. Note that since messages-fields-of-messages are not supported,
    // the tree is only ever at most one layer deep from a root (the only
    // possible children being enum fields of a message).
    if (rootTypes === undefined) {
        // No root types specified, so use the message/enum types in
        // `protoInfo.fileToGenerate` (the files from the command line,
        // without their dependencies). Do another pass through `protoInfo` to
        // get them.
        rootTypes = protoInfo.protoFile
            .filter(file => protoInfo.fileToGenerate.includes(file.name))
            .reduce((rootTypes, file) => {
                const packageName = '.' + file.package;
                const types = [...(file.messageType || []), ...(file.enumType || [])];
                rootTypes.push(...types.map(type => packageName + '.' +  type.name));
                return rootTypes;
            }, []);
    }
    else {
        // If the caller specified rootTypes, make sure that they're fully
        // qualified, and prepend a "." if necessary.
        rootTypes = rootTypes.map(type => {
            if (!type.includes('.')) {
                throw Error(`Root type names must be fully qualified with ` +
                            `respect to package, e.g. "pkg.subpkg.typename". ` +
                            `The following type name is not fully qualified: ` +
                            `${JSON.stringify(type)}`);
            }
            if (!type.startsWith('.')) {
                return '.' + type;
            }
            return type;
        });
    }

    // The resulting array of types are the types whose names are in
    // `rootTypes`, plus the types of any enum fields of messages in
    // `rootTypes`.
    // Build up the result by name in an object (`resultTypes`) to avoid dupes,
    // and then return an array of the object's values.
    const resultTypes = {};
    rootTypes.forEach(typeName => {
        const type = typesByName[typeName];

        if (typeName in resultTypes) {
            return; // already seen it
        }

        resultTypes[typeName] = type;
        if (type.kind !== 'message') {
            return; // no fields to process
        }

        type.fields.forEach(field => {
            const type = field.type;
            const enumTypeName =
                type.enum || (type.array && type.array.enum);
            if (!enumTypeName || enumTypeName in resultTypes) {
                return;
            }

            resultTypes[enumTypeName] = typesByName[enumTypeName];
        });
    });

    const results = Object.values(resultTypes);

    results.forEach(schemas.type.enforce);

    return {
        // Make sure that each resulting type object satisfies `type.tisch.js`
        types: Object.values(resultTypes).map(schemas.type.enforce),

        // {<file>: {<option>: <value>}}
        options: protoOptionsByFile  
    };
}

// Return a `type.tisch.js` object describing a protobuf message defined in the
// specified protobuf `packageName` and having the specified `descriptor`, where
// `descriptor` is the representation of the message within the protoc compiler
// (and its plugins). Use the specified `idFields` to determine which field of
// the type is considered its ID. If there's no override in `idFields`, use the
// "id" field.
function message2type({fileName, packageName, descriptor, idFields}) {
    const typeName = packageName + '.' + descriptor.name;

    // support both ".foo.bar" and "foo.bar" keys in `idFields`, hence the slice.
    const idField = idFields[typeName] || idFields[typeName.slice(1)] || "id";
    if (!descriptor.field.some(field => field.name === idField)) {
        throw Error(`The type ${typeName} does not have the expected ID ` +
                    `field named ${JSON.stringify(idField)}.`);
    }

    return withDocs(descriptor.location, {
        kind: 'message',
        file: fileName,
        name: typeName,
        idFieldName: idField,
        fields: descriptor.field.map(field => withDocs(field.location, {
            id: field.number,
            name: field.name,
            type: field2fieldType(field, typeName)
        }))
    });
}

// Return a `type.tisch.js` object describing a protobuf enum defined in the
// specified protobuf `packageName` and having the specified `descriptor`, where
// `descriptor` is the representation of the enum within the protoc compiler
// (and its plugins).
function enum2type({fileName, packageName, descriptor}) {
    return withDocs(descriptor.location, {
        kind: 'enum',
        file: fileName,
        name: packageName + '.' + descriptor.name,
        values: descriptor.value.map(protoEnumValue =>
            withDocs(protoEnumValue.location, {
                id: protoEnumValue.number,
                name: protoEnumValue.name,
            }))
    });
}

// Return whether the specified `typeName` of a protobuf message type is
// considered a built-in type. Types like "TYPE_INT64" are obviously built-in,
// but we also add some "well-known types," like ".google.protobuf.Timestamp,"
// which is a message type. So, when we see a message type, we need to check
// whether it's one of the "built-in" message types. `typeName` must be fully
// qualified, including a leading period.
function builtinMessage(typeName) {
    return {
        '.google.protobuf.Timestamp': true,
        '.google.protobuf.FieldMask': true,
        '.google.type.Date': true
    }[typeName] || false;
}

// Return the name of the built-in type corresponding to the specified protobuf
// message field type `fieldType`.
// Not all of protobuf's scalar type names are used; some of them are mapped to
// equivalent types. See the comments in `builtin.tisch.js`.
function builtinNameFromFieldType(fieldType) {
    const result = ({
        TYPE_DOUBLE: 'TYPE_DOUBLE',
        TYPE_FLOAT: 'TYPE_FLOAT',
        TYPE_INT64: 'TYPE_INT64',
        TYPE_UINT64: 'TYPE_UINT64',
        TYPE_INT32: 'TYPE_INT32',
        TYPE_FIXED64: 'TYPE_UINT64',
        TYPE_FIXED32: 'TYPE_UINT32',
        TYPE_BOOL: 'TYPE_BOOL',
        TYPE_STRING: 'TYPE_STRING',
        TYPE_BYTES: 'TYPE_BYTES',
        TYPE_UINT32: 'TYPE_UINT32',
        TYPE_SFIXED32: 'TYPE_INT32',
        TYPE_SFIXED64: 'TYPE_INT64',
        TYPE_SINT32: 'TYPE_INT32',
        TYPE_SINT64: 'TYPE_INT64'
    }[fieldType]);

    if (result === undefined) {
        throw Error(`${fieldType} is not a supported type category. Error ` +
                    `occurred while trying to interpret ${fieldType} as a `+
                    `built-in type.`);
    }

    return result;
}

// Return the okra type of the specified protobuf message field `field`. The
// specified `parentTypeName` is used in error diagnostics.
function field2fieldType(field, parentTypeName) {
    let type;

    if (field.type === 'TYPE_MESSAGE' && builtinMessage(field.typeName)) {
        type = {'builtin': field.typeName};
    }
    else if (field.type === 'TYPE_MESSAGE') {
        throw Error(`Field ${field.name} of message ${parentTypeName} is a `+
                    `message. Message fields of messages are not supported.`);
    }
    else if (field.type === 'TYPE_ENUM') {
        type = {'enum': field.typeName};
    }
    else {
        type = {'builtin': builtinNameFromFieldType(field.type)};
    }

    if (field.label === 'LABEL_REPEATED') {
        type = {'array': type};
    }

    return type;
}

// If documentation can be deduced from comments in the specified source
// `location` object, then add a "description" property to the specified
// `object`, where the value of the property is a string of documentation
// derived from comments in `location`. Return `object`.
function withDocs(location, object) {
    const description = location2docs(location);
    if (description !== undefined) {
        object.description = description;
    }

    return object;
}

// Return a string of documentation extracted from the comments in the
// specified source `location` object, or return `undefined` if `location`
// contains no comments.
function location2docs(location) {
    return [
        // 'leadingDetachedComments' are omitted, since they usually don't
        // refer to the thing below them after the blank line.
        'leadingComments', 'trailingComments'
    ].map(property => location[property] || '').join('\n').trim() || undefined;
}

function invokeProtocJson(protoIncludePaths, protoFiles) {
    // `protoc` gets cranky if the .proto files aren't in directories. To make
    // it work, add the parent directory for each .proto file.
    protoIncludePaths = [...protoIncludePaths, ...protoFiles.map(path.dirname)];

    const includeArgs = protoIncludePaths.map(path => `--proto_path=${path}`);

    const compilerPath =
        path.normalize(
            path.join(
                __dirname, '..', 'dependencies', 'protojson', 'tool.py'));

    const args = [...includeArgs, ...protoFiles];

    const options = {
        encoding: 'utf8',
        // Let `stderr` pass through to our `stderr`, because I couldn't get
        // node to capture the error output using "pipe". I don't know why.
        stdio: ['ignore', 'pipe', 'inherit']
    };

    const result = child_process.spawnSync(compilerPath, args, options);

    if (result.status !== 0) {
        // "protoc terminated with status 1", or
        // "protoc terminated with signal 11"
        const what = result.status === null ? 'signal' : 'status';
        const value = result.status === null ? result.signal : result.status;
        throw Error(`protoc terminated with ${what} ${value}`);
    }

    return JSON.parse(result.stdout);
}

return {proto2types};

});
