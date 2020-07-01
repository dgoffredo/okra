define(['child_process', 'path'], function (child_process, path) {
'use strict';

// Return a list of objects satisfying `schemas/type.tisch.js` derived from
// running the protocol buffer compiler (`protoc`) in the specified manner. See
// the comments in the implementation for documentation of the properties of
// `options`.
function proto2types(options) {
    const {
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

        // primaryKeys :: {<type name>: <field name of primary key>}
        // Message types become tables whose primary key corresponds to the
        // "id" field of the message type. `primaryKeys` allows you to specify
        // a different field instead (e.g. if there is no "id" field). The type
        // names must be fully qualified, e.g. type "Foo" in package "lol.wut"
        // is "lol.wut.Foo" or equivalently (for this purpose) ".lol.wut.Foo".
        primaryKeys = {}
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

    // typesByName :: {<fully qualified name>: <type.tisch.js object>}
    const typesByName = protoInfo.protoFile.reduce((typesByName, file) => {
        const package = '.' + file.package;

        (file.messageType || [])
            .map(message => message2type(package, message))
            .forEach(type => typesByName[type.name] = type);

        (file.enumType || [])
            .map(anEnum => enum2type(package, anEnum))
            .forEach(type => typesByName[type.name] = type);

        return typesByName;
    }, {});    

    // Identify the types that will be the roots of the tree of types to
    // generate. Note that since messages-fields-of-messages are not supported,
    // the tree is only ever at most one layer deep from a root (the only
    // possible children being enum fields of a message).
    if (rootTypes === undefined) {
        // No root types specified, so use the message/enum types in
        // `protoFiles` (the files from the command line, without their
        // dependencies). Do another pass through `protoInfo` to get them.
        rootTypes = protoInfo.protoFile
            .filter(file => protoFiles.includes(file.name))
            .reduce((rootTypes, file) => {
                const package = '.' + file.package;
                const types = [...(file.messageType || []), ...(file.enumType || [])];
                rootTypes.push(...types.map(type => package + type.name));
                return rootTypes;
            }, []);
    }

    // The resulting array of types is `rootTypes` plus any enum fields of
    // messages in `rootTypes`.
    // Build up the result by name in an object (`resultTypes`) to avoid dupes,
    // and then return an array of the object's values.
    const resultTypes = {};
    rootTypes.forEach(type => {
        if (type.name in resultTypes) {
            return;
        }

        resultTypes[type.name] = type;
        if (type.kind !== 'message') {
            return;
        }

        type.fields.forEach(field => {
            const enumTypeName = enumName(field.type);
            if (enumTypeName === undefined || enumTypeName in resultTypes) {
                return;
            }

            resultTypes[enumTypeName] = typesByName[enumTypeName];
        });
    });

    return Object.values(resultTypes);
}

// Return the name of the `enum` type referenced in the specified `fieldType`.
// `fieldType` is the `.type` property of a field (`.fields[...]`) in a
// `type.tisch.js` object. If `fieldType` does not refer to an `enum`, return
// `undefined`.
function enumName(fieldType) {
    return fieldType.enum || (field.array && field.array.enum) || undefined;
}

// TODO
function message2type(descriptor) {
    // TODO
}

// TODO
function enum2type(descriptor) {
    // TODO
    /*  {
            'kind': 'enum',
            'name': String,
            'description?': String,
            'values': [{
                'id': Number,
                'name': String,
                'description?': String
            }, ...etc]
        },*/
}

function invokeProtocJson(protoIncludePaths, protoFiles) {
    protoIncludePaths = Array.from(protoIncludePaths); // might modify it

    // `protoc` sometimes gets cranky if the .proto files aren't in directories
    // included in the proto paths. I say _sometimes_, because _sometimes_ it
    // doesn't complain. I don't understand. To make it work, add the parent
    // directory for each .proto file.
    protoFiles.forEach(file => protoIncludePaths.push(path.dirname(file)));

    const includeArgs = protoIncludePaths.map(path => `--proto_path=${path}`);

    const compilerPath =
        path.normalize(
            path.join(
                __dirname, '..', 'dependencies', 'protojson', 'tool.py'));

    const args = [...includeArgs, ...protoFiles];

    const options = {
        encoding: 'utf8',
        // Let `stderr` pass through to our `stderr`, because I couldn't get
        // node to capture the output on error with "pipe". I don't know why.
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
