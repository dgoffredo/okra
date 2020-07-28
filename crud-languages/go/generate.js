// This module provides a function, `generate`, that takes:
// - an object as produced by some SQL dialect's `types2crud` function,
// - an array of Okra types, and
// - an object of proto file options (by file)
//
// and returns a string containing Go source code for a module that implements
// the CRUD operations.
define([
    './prerendered',
    './render',
    '../../dependencies/tisch/tisch',
    '../../schemas/schemas',
    '../../lib/names'],
    function (prerendered, {renderFile}, tisch, schemas, names) {
// 'use strict';
// SyntaxError: Illegal 'use strict' directive in function with non-simple parameter list

function deepCopy(from) {
    // JSON-compatible data only. What do you want?
    return JSON.parse(JSON.stringify(from));
}

// Return an object
//
//     {
//         protoImports: function () => {<full package>: <package alias>},
//         typePackageAlias: function (<type name>) => <package alias>
//     }
//
// where `.protoImports` is a function that returns package imports for the
// protoc generated code of the specified `types` array, and
// `.typePackageAlias` is a function that maps each name of the `types` to the
// alias of the package in which that type is defined. Use the specified
// `options` object of per-file protobuf options to associate types with Go
// packages (using the `go_package` option). Note that the returned object is
// stateful. Based on the type names passed to `.typePackageAlias` and on the
// call order, the package aliases returned by `.typePackageAlias` and by
// `.protoImports()` will differ (e.g. "a" -> "pb", "b" -> "pb2"; versus "b" ->
// "pb", "a" -> "pb2").
function typeImports({types, options}) {
    // {<file>: <package>}
    const packageByFile = Object.entries(options).reduce(
        (packages, [file, fileOptions]) => {
        // Protobuf JSONification changes the naming convention for fields, so
        // it's `goPackage`, not `go_package`.
        if (fileOptions.goPackage) {
            // The `go_package` option supports special syntax:
            // "some/real/name;alias" where the part after the semicolon can be
            // different from the "name" part. We're interested in just the
            // full package name itself, so omit any after-semicolon section.
            const fullPackageName =
                fileOptions.goPackage.split(';').slice(0, -1).join(';');
            packages[file] = fullPackageName;
        }
        return packages;
    }, {});

    // {<type name>: <package>}
    const packageByType = Object.values(types).reduce((byType, {file, name}) => {
        if (file === undefined) {
            throw Error(`Type named ${name} is not associated with a .proto ` +
                `file, which means we can't deduce in which Go package to ` +
                `find its generated Go code.`);
        }
        if (!(file in packageByFile)) {
            throw Error(`Type named ${name} defined in proto file ${file}, ` +
                `but that file does not declare a go_package option, so we ` +
                `can't deduce in which Go package to find the type's ` +
                `generated Go code.`);
        }
        byType[name] = packageByFile[file];
        return byType;
    }, {});

    const packageAliases = {}; // {<package>: <alias>}

    function typePackageAlias(typeName) {
        const packageName = packageByType[typeName];
        let alias = packageAliases[packageName];
        if (alias !== undefined) {
            return alias;
        }

        // Create a new alias. If it's the first one, call it "pb". If it's the
        // second one, call it "pb2", etc.
        const numMentionedPackages = Object.keys(packageAliases).length;
        if (numMentionedPackages === 0) {
            alias = 'pb';
        }
        else {
            alias = `pb${numMentionedPackages + 1}`;
        }

        packageAliases[packageName] = alias;
        return alias;
    }

    function protoImports() {
        return deepCopy(packageAliases);
    }

    return {protoImports, typePackageAlias};
}

// Return a string of Go source code for a module that implements the CRUD
// operations indicated by the specified arguments:
// - `crud`: an object as produced by some SQL dialect's `types2crud` function
// - `types`: an array of Okra types
// - `options`: an object of proto file options (by file)
function generate({crud, types, options}) {
    // Verify that the arguments have the expected shape.
    // - `crud`
    schemas.crud.enforce(crud);
    // - `types`
    types.forEach(schemas.type.enforce);
    // - `options`
    tisch.compileFunction(({Any, etc}) => ({
        // file path -> FileOptions object from protocol buffer compiler
        [Any]: Object,
        ...etc
    })).enforce(options);

    const {protoImports, typePackageAlias} = typeImports({types, options});
    const messages = types.filter(type => type.kind === 'message');

    // Make `types` an object by-name rather than just an array.
    types = Object.fromEntries(types.map(type => [type.name, type]));

    const documentation =
`Package crud provides create/read/update/delete (CRUD) database operations
for protobol buffer message types.

This file is generated code. Please do not modify it by hand.`;

    const goFile = {
        documentation,
        package: 'crud',
        imports: {}, // will be added to based on the declarations
        declarations: messages.map(message => [
            funcCreate({
                typeName: message.name,
                instructions: crud[message.name].create,
                types, 
                typePackageAlias
            }),
            // funcRead(message, TODO),
            // funcUpdate(message, TODO),
            // funcDelete(message, TODO)
        ]).flat()
    };

    // Calls to `typePackageAlias` have been helping decide which
    // protobuf-generated Go modules need to be imported and what to call them.
    // `protoImports()` is the result.
    Object.assign(goFile.imports, protoImports());

    // If the functions in `goFile` referenced utility functions, like those
    // used to convert dates and timestamps to/from okra's custom formats,
    // include the definitions of those functions.
    includePrerendered(goFile);

    // Look for references to standard packages, like "fmt," and import them if
    // they aren't already.
    includeStandardImports(goFile);

    // TODO: debug
    // console.log(JSON.stringify(goFile, undefined, 4));

    return renderFile(goFile);
}

// Return a Go AST node representing a func that creates a new instance of a
// message of the specified `typeName` in the database using the specified CRUD
// `instructions`. Use the specified `types` object of okra types by name to
// inspect the message type and any enum types that it might depend upon. Use
// the specified `typePackageAlias` function to look up which package aliases
// (e.g. "pb", "p2") a given message/enum type belongs to.
function funcCreate({typeName, instructions, types, typePackageAlias}) {
    // Here's a reminder of what a function (func) looks like:
    //
    //     {'function': {
    //          'documentation?': String,
    //          'name': String,
    //          'arguments': [{'name?': String, 'type': String}, ...etc],
    //          'results': [{'name?': String, 'type': String}, ...etc],
    //          'body': {
    //              'variables': [variable, ...etc],
    //              'statements': [statement, ...etc]
    //          }}}

    // Here's what we're going for:
    //
    //     // CreateFooBar adds the specified message to the specified db subject to
    //     // the specified cancellation context ctx. Return nil on success, or return
    //     // a non-nil value if an error occurs.
    //     func CreateFooBar(ctx context.Context, db *sql.DB, message pb.FooBar) (err error) {
    //         transaction, err = db.BeginTx(ctx, nil)
    //         if err != nil {
    //             return
    //         }
    //
    //         ... all the instructions ...
    //
    //         err = transaction.Commit()
    //         return
    //     }

    const funcName = `Create${messageOrEnum2go(typeName)}`;
    const documentation =
`${funcName} adds the specified message to the specified db subject to the
specified cancellation context ctx. Return nil on success, or return a
non-nil value if an error occurs.`;
    const arguments = [
        {name: 'ctx', type: 'context.Context'},
        {name: 'db', type: '*sql.DB'},
        {name: 'message',
         type: `${typePackageAlias(typeName)}.${messageOrEnum2go(typeName)}`}
    ];
    const results = [{name: 'err', type: 'error'}];
    const variables = [{name: 'transaction', type: '*sql.Tx'}];
    const func = {
        documentation,
        name: funcName,
        arguments,
        results,
        body: {
            variables,
            // Begin by starting a transaction. We'll fill out the rest later.
            statements: [
                // transaction, err = db.BeginTx(ctx, nil)
                {assign: {
                    left: ['transaction', 'err'],
                    right: [{call: {
                        function: {dot: ['db', 'BeginTx']},
                        arguments: [{symbol: 'ctx'}, null]
                    }}]
                }},

                // if err != nil {
                //     return
                // }
                {if: {
                    condition: {notEqual: {
                        left: {symbol: 'err'},
                        right: null
                    }},
                    body: [{return: []}]
                }},

                //
                {spacer: 1}
            ]
        }
    };

    // Define the functions needed by the instruction handlers.

    // field2type :: <fieldName> -> <okra type>
    const field2type = (function () {
        const fieldTypeByFieldName = types[typeName].fields.reduce(
            (byName, {name, type}) => Object.assign(byName, {[name]: type}),
            {});

        return function (fieldName) {
            return fieldTypeByFieldName[fieldName];
        };
    }());

    // variable({name, goType}) adds the variable with the specified name and
    // having the specified type to the func's variable declarations section if
    // it hasn't been added already, and returns the name of the variable.
    const variable = (function () {
        const alreadyDeclared = {};

        return function({name, goType}) {
            if (name in alreadyDeclared) {
                return name;
            }

            // This is the first time we've seen this variable. Add it to the
            // func's variable declarations.
            variables.push({name, type: goType});
            alreadyDeclared[name] = true;
            return name;
        };
    }());

    // In a "create" func, all fields are "included," so this always returns
    // `true`.
    function included(fieldName /*ignored*/) {
        return true;
    }

    // Generate statements that implement each instruction, and append the
    // statements to the body of the func.
    func.body.statements.push(...performInstructions({
        instructions,
        field2type,
        variable,
        included,
        typePackageAlias
    }));

    // Commit the transaction and return.
    func.body.statements.push(
        // err = transaction.Commit()
        {assign: {
            left: ['err'],
            right: [{
                call: {
                    function: {dot: ['transaction', 'Commit']},
                    arguments: []
                }
            }]
        }},

        // return
        {return: []});

    return {function: func};
}

// Return the Go struct field name that would be generated for the specified
// `protoFieldName`. The convention for protobuf message fields is to use
// lower_snake_case (but it's not enforced), while the generated Go code uses
// TitleCamelCase, except where parts of the input name had MaybeSomeALLCaps.
function field2go(protoFieldName) {
    return names.normalize(protoFieldName, 'TitleCamelCase');
}

// Return the Go struct or enum type name that would be generated for the specified
// `protoName`, where `protoName` is the name of a protobuf message or enum.
function messageOrEnum2go(protoName) {
    // `basename` e.g. ".foo.bar.Baz" -> "Baz"
    const basename = protoName.split('.').slice(-1)[0];

    return names.normalize(basename, 'TitleCamelCase');
}

// Return a string containing the Go spelling for the type corresponding to the
// specified `okraType`. Use the specified `typePackageAlias` function to
// determine Go package, if necessary.
//
// For example:
// - {builtin: "TYPE_STRING"} → "string"
// - {builtin: "name"} → "string"
// - {enum: "Foo"} → "pb.Foo" (or "pb7.Foo" depending on `typePackageAlias`)
// - {array: {builtin: "TYPE_INT64"}} → "[]int64"
// - {builtin: ".google.protobuf.Timestamp"} → "*timestamp.Timestamp"
// - {array: {builtin: ".google.type.Date"}} → "[]*date.Date"
//
function type2go({
    // e.g. `{builtin: 'TYPE_STRING'}`, or `{array: {enum: '.Foo'}}`
    okraType,

    // function that maps message/enum type name to a Go package alias
    typePackageAlias
}) {
    if (okraType.array) {
        return `[]${type2go({okraType: okraType.array, typePackageAlias})}`;
    }

    if (okraType.enum) {
        const enumName = messageOrEnum2go(okraType.enum);
        const packageAlias = typePackageAlias(enumName);
        return `${packageAlias}.${enumName}`;
    }

    // See `builtin.tisch.js`.
    return {
        '.google.protobuf.Timestamp': '*timestamp.Timestamp',
        '.google.type.Date': '*date.Date',
        'TYPE_DOUBLE': 'float64',
        'TYPE_FLOAT': 'float32',
        'TYPE_INT64': 'int64',
        'TYPE_UINT64': 'uint64',
        'TYPE_INT32': 'int32',
        'TYPE_UINT32': 'uint32',
        'TYPE_BOOL': 'bool',
        'TYPE_STRING': 'string',
        'TYPE_BYTES': '[]byte'
    }[okraType.builtin];
}

// The following functions, each named "perform ..." (e.g. performQuery,
// performReadRow) translate a CRUD instruction into an array of Go statements
// that are expanded into a Go function to perform the CRUD instruction. There
// is one for each possible CRUD instruction.
//
// All of the "perform ..." functions assume that the following variables are
// in scope:
// - `message` is the protobuf message struct being read from or written to.
// - `transaction` is the `sql.Tx` object for the current database transaction.
// - `ctx` is the `context.Context` object describing the current cancellation
//   context.
// - `err` is the `error` variable to assign to before returning due to an
//   error.
//
// If an instruction encounters an error, it will assign to `err` and then
// return using a `return` statement without any arguments. Thus the function
// in which the instruction is expanded must use named return values.

// The following snippet of Go AST occurs in a few places, so here it is once for reuse:
//
//     if err != nil {
//         err = combineErrors(err, transaction.Rollback())
//         return
//     }
const ifErrRollbackAndReturn = {
    if: {
        condition: {notEqual: {left: {symbol: 'err'}, right: null}},
        body: [
            // err = combineErrors(err, transaction.Rollback())
            {assign: {
                left: ['err'],
                right: [{call: {
                    function: 'combineErrors',
                    arguments: [
                        {symbol: 'err'},
                        {call: {
                            function: {dot: ['transaction', 'Rollback']},
                            arguments: []
                        }}
                    ]
                }}]}},

            // return (because an error occurred)
            {return: []}
        ]
}};

// Return an a Go AST expressions for the specified `parameter` that can appear
// as input parameters to database methods like `Query` and `Exec`. This code
// is common to relevant CRUD instructions.
function inputParameter2expression({parameter, field2type, included}) {
    if (parameter.field) {
        const type = field2type(parameter.field); // okra type
        const member = field2go(parameter.field); // Go struct field name
        if (type.builtin === '.google.protobuf.Timestamp') {
            return {
                // fromTimestamp(message.someField)
                call: {
                    function: 'fromTimestamp',
                    arguments: [{dot: ['message', member]}]
                }
            };
        }
        else if (type.builtin === '.google.type.Date') {
            return {
                // fromDate(message.someField)
                call: {
                    function: 'fromDate',
                    arguments: [{dot: ['message', member]}]
                }
            };
        }
        else {
            // message.someField
            return {dot: ['message', member]};
        }
    }
    else {
        // Instead of referencing a field value, we're asking whether the
        // field is involved in the current operation.
        return included(parameter.included);
    }
}

// Return an array of Go AST expressions, one element for each of the specified
// `parameters`, that can appear as input parameters to database methods like
// `Query` and `Exec`. This code is common to relevant CRUD instructions.
function inputParameters2expressions({
    // array of input parameters, per `ast.tisch.js`
    parameters,

    // function that maps a message field name to an okra type
    field2type,

    // function that returns an expression for whether a field is included in the CRUD operation
    included
}) {
    return parameters.map(parameter => 
        inputParameter2expression({parameter, field2type, included}));
}

// Return an array of statements that perform each of the specified
// `instructions`, one after the other, in the context implied by the other
// specified arguments.
function performInstructions({
    // array of CRUD instruction
    instructions,

    // function that maps a message field name to an okra type
    field2type,

    // function that registers a specified `variable({name, goType})` and returns `name`
    // Note that that variables that are _assumed_ to be in scope, such as
    // `ctx`, `message`, `transaction`, and `err`, don't need to use this
    // function. It's for variables like `rows` and `ok`.
    variable,

    // function that returns an expression for whether a field is included in the CRUD operation
    included,

    // function that maps message/enum type name to a Go package alias
    typePackageAlias
}) {
    const handlerByName = {
        'query': performQuery,
        'read-row': performReadRow,
        'read-array': performReadArray,
        'exec': performExec,
        'exec-with-tuples': performExecWithTuples
    };

    return instructions.map(instruction => {
        const statements = handlerByName[instruction.instruction]({
            instruction,
            field2type,
            variable,
            included,
            typePackageAlias
        });

        // Append a blank line to separate from the next set of statements.
        statements.push({spacer: 1});
        return statements;
    }).flat();
}

// Return an array of statements that perform the specified CRUD "query"
// `instruction` in the context implied by the other specified arguments.
function performQuery({
    // the "query" CRUD instruction
    instruction,

    // function that maps a message field name to an okra type
    field2type,

    // function that registers a specified `variable({name, goType})` and returns `name`
    // Note that that variables that are _assumed_ to be in scope, such as
    // `ctx`, `message`, `transaction`, and `err`, don't need to use this
    // function. It's for variables like `rows` and `ok`.
    variable,

    // function that returns an expression for whether a field is included in the CRUD operation
    included
}) {
    // Reminder of the shape of a "query" instruction:
    //
    //    {
    //        'instruction': 'query',
    //        'sql': String,
    //        'parameters': [inputParameter, ...etc]
    //    }
    
    // Here's what we're going for:
    //
    //     rows, err = transaction.QueryContext(ctx, $query, $parameters ...)
    //     if err != nil {
    //         err = combineErrors(err, transaction.Rollback())
    //         return
    //     }

    const parameters = inputParameters2expressions({
        parameters: instruction.parameters,
        field2type,
        included
    });

    // The following code references this variable.
    variable({name: 'rows', goType: '*sql.Rows'})

    return [
        // rows, err = transaction.QueryContext(ctx, $query, $parameters)
        {assign: {
            left: ['rows', 'err'],
            right: [{
                call: {
                    function: {dot: ['transaction', 'QueryContext']},
                    arguments: [
                        {symbol: 'ctx'},
                        instruction.sql,
                        ...parameters
                    ]
                }
            }]
        }},

        // if err != nil {
        //     err = combineErrors(err, transaction.Rollback())
        //     return
        // }
        ifErrRollbackAndReturn
    ]
}

// Return an array of statements that perform the specified CRUD "read-row"
// `instruction` in the context implied by the other specified arguments.
function performReadRow({
    // the "read-row" CRUD instruction
    instruction,

    // function that maps a message field name to an okra type
    field2type,

    // function that registers a specified `variable({name, goType})` and returns `name`
    // Note that that variables that are _assumed_ to be in scope, such as
    // `ctx` and `transaction`, don't need to use this function. It's for
    // variables like `rows` and `ok`.
    variable,

    // function that returns an expression for whether a field is included in the CRUD operation
    // included
    // NOTE: `included` is not used here. In the future, it could be used to
    // decide which output parameters refer to message fields (included ones)
    // and which output parameters go to an effective /dev/null (excluded
    // ones). However, I don't currently have a need for this. `include` would
    // be defined as "always true." So, I instead omit it for now.
}) {
    // Reminder of the shape of a "read-row" instruction:
    //
    //    {
    //        'instruction': 'read-row',
    //        'destinations': [outputParameter, ...etc]
    //    }
    
    // Here's what we're going for:
    //
    //     ok = rows.Next()
    //     if !ok {
    //         err = fmt.Errorf("Unable to read row from database. There is no row.")
    //         err = combineErrors(err, transaction.Rollback())
    //         return
    //     }
    //     
    //     err = rows.Scan($destinations)
    //     if err != nil {
    //         err = combineErrors(err, transaction.Rollback())
    //         return
    //     }

    const destinations = instruction.destinations.map(destination => {
        const type = field2type(destination.field); // okra type
        const member = field2go(destination.field); // Go struct field name
        if (type.builtin === '.google.protobuf.Timestamp') {
            return {
                // intoTimestamp(&message.someField)
                call: {
                    function: 'intoTimestamp',
                    arguments: [{address: {dot: ['message', member]}}]
                }
            };
        }
        else if (type.builtin === '.google.type.Date') {
            return {
                // intoDate(&message.someField)
                call: {
                    function: 'intoDate',
                    arguments: [{address: {dot: ['message', member]}}]
                }
            };
        }
        else {
            // &message.someField
            return {address: {dot: ['message', member]}};
        }
    });

    // The following code references these variables.
    variable({name: 'rows', goType: '*sql.Rows'})
    variable({name: 'ok', goType: 'bool'})

    return [
        // ok = rows.Next()
        {assign: {
            left: ['ok'],
            right: [{
                call: {
                    function: {dot: ['rows', 'Next']},
                    arguments: []
                }
            }]
        }},

        // if !ok {
        //     err = fmt.Errorf("Unable to read row from database. There is no row.")
        //     err = combineErrors(err, transaction.Rollback())
        //     return
        // }
        {if: {
            condition: {not: {symbol: 'ok'}},
            body: [
                {assign: {
                    left: ['err'],
                    right: [{
                        call: {
                            function: {dot: ['fmt', 'Errorf']},
                            arguments: [
                                "Unable to read row from database. There is no row."
                            ]
                        }
                    }]
                }},
                {assign: {
                    left: ['err'],
                    right: [{
                        call: {
                            function: 'combineErrors',
                            arguments: [
                                {symbol: 'err'},
                                {call: {
                                    function: {dot: ['transaction', 'Rollback']},
                                    arguments: []
                                }}
                            ]
                        }
                    }]
                }},
                {return: []}
            ]
        }},

        //
        {spacer: 1},

        // err = rows.Scan($destinations)
        {assign: {
            left: ['err'],
            right: [{
                call: {
                    function: {dot: ['rows', 'Scan']},
                    arguments: destinations
                }
            }]
        }},

        // if err != nil {
        //     err = combineErrors(err, transaction.Rollback())
        //     return
        // }
        ifErrRollbackAndReturn
    ];
}

// Return an array of statements that perform the specified CRUD "read-array"
// `instruction` in the context implied by the other specified arguments.
function performReadArray({
    // the "read-array" CRUD instruction
    instruction,

    // function that maps a message field name to an okra type
    field2type,

    // function that registers a specified `variable({name, goType})` and returns `name`
    // Note that that variables that are _assumed_ to be in scope, such as
    // `ctx` and `transaction`, don't need to use this function. It's for
    // variables like `rows` and `ok`.
    variable,

    // function that returns an expression for whether a field is included in the CRUD operation
    // included
    // NOTE: `included` is not used here. See the note in `performReadRow`.

    // function that maps message/enum type name to a Go package alias
    typePackageAlias
}) {
    // Reminder of the shape of a "read-array" instruction:
    //
    //    {
    //        'instruction': 'read-array',
    //        'destination': outputParameter
    //    }
    
    // Here's what we're going for:
    //
    //     for rows.Next() {
    //         var temp whateverGoType
    //         err = rows.Scan(&temp) // might use intoDate or intoTimestamp
    //         if err != nil {
    //             err = combineErrors(err, transaction.Rollback())
    //             return
    //         }
    //         $destination = append($destination, temp)
    //     }

    // For each row, we scan one array element into a temporary variable
    // `temp`. The expression that we pass to `rows.Scan` depends on the type
    // of the destination array. `intoTemp` is that expression.
    const elementType = field2type(instruction.destination.field).array;
    const intoTemp = (function () {
        // &temp
        const address = {address: {symbol: 'temp'}};

        if (elementType.builtin === '.google.protobuf.Timestamp') {
            // intoTimestamp(&temp)
            return {call: {function: 'intoTimestamp', arguments: [address]}};
        }
        else if (elementType.builtin === '.google.type.Date') {
            // intoDate(&temp)
            return {call: {function: 'intoDate', arguments: [address]}};
        }
        else {
            // &temp
            return address;
        }
    }());

    // the array we're appending to
    const destinationGoArray = {
        dot: ['message', field2go(instruction.destination.field)]
    };

    // The following code references this variable.
    variable({name: 'rows', goType: '*sql.Rows'})

    return [{
        // for rows.Next() {
        conditionFor: {
            condition: {
                call: {
                    function: {dot: ['rows', 'Next']},
                    arguments: []
                }
            },
            body: [
                // var temp whateverGoType
                {variable: {
                    name: 'temp',
                    // The destination is an array. We want an instance of
                    // an _element_ of the array.
                    type: type2go({okraType: elementType, typePackageAlias})
                }},
                
                // err = rows.Scan(&temp) // might use intoDate or intoTimestamp
                {assign: {
                    left: ['err'],
                    right: [{
                        call: {
                            function: {dot: ['rows', 'Scan']},
                            arguments: [intoTemp]
                        }
                    }]
                }},

                // if err != nil {
                //     err = combineErrors(err, transaction.Rollback())
                //     return
                // }
                ifErrRollbackAndReturn,

                // $destination = append($destination, temp)
                {assign: {
                    left: [destinationGoArray],
                    right: [{
                        call: {
                            function: 'append',
                            arguments: [
                                destinationGoArray,
                                {symbol: 'temp'}
                            ]
                        }
                    }]
                }}
            ]
        }
    }];
}

// Return an array of statements that perform the specified CRUD "exec"
// `instruction` in the context implied by the other specified arguments.
function performExec({
    // the "exec" CRUD instruction
    instruction,

    // function that maps a message field name to an okra type
    field2type,

    // function that registers a specified `variable({name, goType})` and returns `name`
    // Note that that variables that are _assumed_ to be in scope, such as
    // `ctx` and `transaction`, don't need to use this function. It's for
    // variables like `rows` and `ok`.
    // variable,
    // NOTE: This instruction doesn't use any non-implicit variables.

    // function that returns an expression for whether a field is included in the CRUD operation
    included
}) {
    // Reminder of the shape of a "exec" instruction:
    //
    //    {
    //        'instruction': 'exec',
    //        'condition?': {'included': String},
    //        'sql': String,
    //        'parameters': [inputParameter, ...etc]
    //    }
    
    // Here's what we're going for
    //
    //     _, err = transaction.ExecContext(ctx, $query, $parameters ...)
    //     if err != nil {
    //         err = combineErrors(err, transaction.Rollback())
    //         return
    //     }
    //
    // or, if there's a "condition," wrap the above in an `if` statement.

    const parameters = inputParameters2expressions({
        parameters: instruction.parameters,
        field2type,
        included
    });

    // If there's a condition, we'll wrap all of this in an `if`.
    const statements = [
        // _, err = transaction.ExecContext(ctx, $sql, $parameters ...)
        {assign: {
            left: ['_', 'err'],
            right: [{
                call: {
                    function: {dot: ['transaction', 'ExecContext']},
                    arguments: [
                        {symbol: 'ctx'},
                        instruction.sql,
                        ...parameters
                    ]
                }
            }]
        }},

        // if err != nil {
        //     err = combineErrors(err, transaction.Rollback())
        //     return
        // }
        ifErrRollbackAndReturn
    ];

    if ('condition' in instruction) {
        return [{
            if: {
                condition: included(instruction.condition.included),
                body: statements
            }
        }];
    }
    else {
        return statements;
    }
}

// Return an array of statements that perform the specified CRUD "exec"
// `instruction` in the context implied by the other specified arguments.
function performExecWithTuples({
    // the "exec-with-tuples" CRUD instruction
    instruction,

    // function that maps a message field name to an okra type
    field2type,

    // function that registers a specified `variable({name, goType})` and returns `name`
    // Note that that variables that are _assumed_ to be in scope, such as
    // `ctx` and `transaction`, don't need to use this function. It's for
    // variables like `rows` and `ok`.
    variable,

    // function that returns an expression for whether a field is included in the CRUD operation
    included
}) {
    // Verify that exactly one of the `instruction.parameters` has array type.
    // Also, verify that all of the `instruction.parameters` have the shape
    // `{field: ...}` (instead of `{included: ...}`).
    instruction.parameters.forEach(parameter => {
        if (!('field' in parameter)) {
            throw Error(`Expected "exec-with-tuples" parameters to be of ` +
                `{field: ...} kind, but encountered: ` +
                `${JSON.stringify(parameter)} in instruction: ` +
                JSON.stringify(instruction));
        }
    });

    const arrays = instruction.parameters.filter(
        parameter => field2type(parameter.field).array);

    if (arrays.length !== 1) {
        throw Error(`Expected "exec-with-tuples" parameters to contain ` +
            `exactly one array-valued field, but found ${arrays.length}: ` +
            JSON.stringify(arrays));
    }

    const [arrayField] = arrays.map(parameter => parameter.field);

    // Here's what we're going for:
    //
    //     if $included && len($array) != 0 {
    //         parameters = nil // clear the slice
    //
    //         for _, element := range message.$array {
    //             parameters = append(parameters, [...], element, [...])
    //         }
    //
    //         _, err = transaction.ExecContext(
    //             ctx,
    //             withTuples($sql, $tuple, len($array)),
    //             parameters...)
    //
    //         if err != nil {
    //             err = combineErrors(err, transaction.Rollback())
    //             return
    //         }
    //     }

    // The following code references this variable.
    variable({name: 'parameters', goType: '[]interface{}'});

    const arrayLengthExpression = {
        call: {
            function: 'len',
            arguments: [
                {dot: ['message', field2go(arrayField)]}
            ]
        }
    };

    // `condition` is what goes in the "if" condition.
    let condition;
    // $included && len($array) != 0
    if ('condition' in instruction &&
        // if inclusion is hard-coded to true, then omit that part
        included(instruction.condition.included) !== true) {
        condition = {
            and: {
                left: included(instruction.condition.included),
                right: {notEqual: {
                    left: arrayLengthExpression,
                    right: 0}}
            }
        };
    }
    // len($array) != 0
    else {
        condition = {
            notEqual: {
                left: arrayLengthExpression,
                right: 0
            }
        };
    }

    return [
        // if $condition {
        {if: {
            condition: condition,
            body: [
                // parameters = nil
                {assign: {
                    left: ['parameters'],
                    right: [null]
                }},

                // for _, element := range message.$array {
                //     ...
                // }
                {rangeFor: {
                    variables: ['_', 'element'],
                    sequence: {dot: ['message', field2go(arrayField)]},
                    body: [
                        // parameters = append(parameters, [...], element, [...])
                        {assign: {
                            left: ['parameters'],
                            right:  [{call: {
                                function: 'append',
                                arguments: [
                                    {symbol: 'parameters'},
                                    // The rest of the arguments to `append`
                                    // correspond to the
                                    // `instruction.parameters`. One of them
                                    // will be `element` (the one array field),
                                    // while the rest will be the other fields
                                    // repeated again this time around the
                                    // loop.
                                    ...instruction.parameters.map(parameter => {
                                        if (parameter.field === arrayField) {
                                            return {symbol: 'element'};
                                        }
                                        else {
                                            return inputParameter2expression({
                                                parameter,
                                                field2type,
                                                included
                                            });
                                        }
                                    })
                                ]
                            }}]
                        }}
                    ]
                }},

                // _, err = transaction.ExecContext(
                //     ctx,
                //     withTuples($sql, $tuple, len($array)),
                //     parameters...)
                {assign: {
                    left: ['_', 'err'],
                    right: [{
                        call: {
                            function: {dot: ['transaction', 'ExecContext']},
                            arguments: [
                                {symbol: 'ctx'},
                                // withTuples($sql, $tuple, len($array))
                                {call: {
                                    function: 'withTuples',
                                    arguments: [
                                        instruction.sql,
                                        instruction.tuple,
                                        arrayLengthExpression 
                                    ]
                                }}
                            ],
                            rest: {symbol: 'parameters'}
                        }
                    }]
                }},

                // if err != nil {
                //     err = combineErrors(err, transaction.Rollback())
                //     return
                // }
                ifErrRollbackAndReturn
            ]
        }}
    ];
}

function isObject(value) {
    // Good enough. Google "javascript check if object is object literal."
    return value !== null &&
        Object.prototype.toString.call(value) === '[object Object]';
}

// Walk the specified `tree`, which is just a javascript value, invoking the
// specified `visitor` with each node. The traversal is depth-first pre-order
// (`visitor` is invoked on a node before the node's children are visited). `walk`
// returns `undefined`.
//
// For example,
//
//     const tree = [
//         {foo: 'hello'},
//         {bar: [1, 2, 3], baz: 7}
//     ];
//
//     let count = 0;
//     function visit(node) {
//         if (typeof node === number) {
//             ++count;
//         }
//     }
//
//     walk(tree, visit);
//
//     console.log(`encountered ${count} numbers`);
//
// prints "encountered 4 numbers".
//
// Note that the only values that are searched for children are arrays and
// object literals.
function walk(tree, visit) {
    function recur(tree) {
        visit(tree);

        if (Array.isArray(tree)) {
            tree.forEach(recur);
        }
        else if (isObject(tree)) {
            Object.values(tree).forEach(recur);
        }
    }

    recur(tree);
}

// Search through the specified `goFile` AST for references to pre-rendered
// functions. Add imports and toplevel declarations to `goFile` as necessary to
// satsify those references. Return `goFile`. Note that `goFile` is modified in
// place.
function includePrerendered(goFile) {
    const referenced = {}; // set of function names

    function visit(node) {
        // Here's a reminder about the shape of a "call" AST node:
        //
        //     {'call': {
        //         'function': or(String, dot),
        //         'arguments': [expression, ...etc]}}
        //
        if (isObject(node) &&
            'call' in node &&
            typeof node.call.function === 'string' &&
            node.call.function in prerendered) {
            referenced[node.call.function] = true;
        }
    }

    walk(goFile.declarations, visit);

    // Fill `goFile` with additional imports and declarations based on what was
    // `referenced`.
    Object.keys(referenced).forEach(name => {
        const {imports, declarations} = prerendered[name];

        // We could just do `goFile.imports.assign(imports)`, but let's catch
        // disagreements about the package alias, if any.
        Object.entries(imports).forEach(([package, alias]) => {
            if (package in goFile.imports && goFile.imports[package] !== alias) {
                throw Error(`There is a package alias name conflict for the ` +
                    `package ${package}. Error occurred while adding ` +
                    `pre-rendered code for ${name}.`);
            }

            goFile.imports[package] = alias;
        });

        // Add the declarations to the end of the file (anywhere would work).
        goFile.declarations.push(...declarations);
    });

    return goFile;
}

// Search through the specified `goFile` AST for references to standard
// packages. Add imports to `goFile` as necessary to satisfy those references.
// Return `goFile`. Note that `goFile` is modified in place.
function includeStandardImports(goFile) {
    // {<identifier after import>: <full package name>}
    const standardImports = {
        // `fmt.Errorf` is used in some places.
        fmt: 'fmt'
    };

    // {<full package name>: null}
    // the `null` means "no alias"
    const newImports = {}

    function visit(node) {
        // Here's a reminder about the shape of a "call" AST node:
        //
        //     {'call': {
        //         'function': or(String, dot),
        //         'arguments': [expression, ...etc]}}
        //
        if (isObject(node) &&
            'call' in node &&
            node.call.function.dot &&
            node.call.function.dot[0] in standardImports) {
            const importPath = standardImports[node.call.function.dot[0]];
            newImports[importPath] = null;
        }
    }

    walk(goFile.declarations, visit)

    // `newImports` now contains candidates for `import` statements to add to
    // the `goFile`. Add any that aren't already there, and make sure that
    // aliases agree.
    Object.entries(newImports).forEach(([package, alias]) => {
        if (package in goFile.imports && goFile.imports[package] !== alias) {
            throw Error(`There is a package alias name conflict for the ` +
                `package ${package}. Error occurred while adding ` +
                `standard import.`);
        }

        goFile.imports[package] = alias;
    });

    return goFile;
}

return {generate};

});
