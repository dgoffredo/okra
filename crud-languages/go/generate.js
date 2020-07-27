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

// Return a string of Go source code for a module that implements the CRUD
// operations indicated by the specified arguments:
// - `crud`: an object as produced by some SQL dialect's `types2crud` function
// - `types`: an array of Okra types
// - `options`: an object of proto file options (by file)
function generate({crud, types, options}) {
    /* TODO: hack hack
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

    // Make `types` an object by-name rather than just an array.
    types = Object.fromEntries(types.map(type => [type.name, type]));
    TODO: end hack hack*/

    // TODO: hack hack
    const func = {
        documentation: 'Foo does the thing.',
        name: 'Foo',
        arguments: [],
        results: [],
        body: {
            variables: [],
            statements: []
        }
    };

    const goFile = {
        documentation: 
`This is a thing it does a thing.

You will never believe how thingy this thing is. It is simply the best thing
that a thing has ever thinged.

Things go way back. Back to the beginning of things. But always there was
this thing.

It is, truly, the thingest thing of all things.`,
        package: 'crud',
        imports: {}, // TODO: from go_package option per file (yikes what about aliases)
        declarations: [
            {function: func}
        ]
    };

    func.body.statements.push(...performQuery({
        instruction: {
            instruction: 'query',
            sql: "select `id`, `name` from person where `id` = ?;",
            parameters: [{field: 'id_my_favorite_sandwich'}]
        },
        field2type: function (field) {
            return {
                id_my_favorite_sandwich: {builtin: '.google.type.Date'},
                name: {builtin: 'TYPE_STRING'}
            }[field];
        },
        variable: function ({name, goType}) {
            func.body.variables.push({name, type: goType}); // TODO: dupes
            return name;
        },
        included: function (field) {
            return true;
        }
    }));

    func.body.statements.push({spacer: 1});

    func.body.statements.push(...performReadRow({
        instruction: {
            instruction: 'read-row',
            destinations: [
                {field: 'id_my_favorite_sandwich'},
                {field: 'name'}
            ],
        },
        field2type: function (field) {
            return {
                id_my_favorite_sandwich: '.google.type.Date',
                name: {builtin: 'TYPE_STRING'}
            }[field];
        },
        variable: function ({name, goType}) {
            func.body.variables.push({name, type: goType}); // TODO: dupes
            return name;
        },
    }));

    func.body.statements.push({spacer: 1});

    func.body.statements.push(...performReadArray({
        instruction: {
            instruction: 'read-array',
            destination: {field: 'dates'}
        },
        field2type: function (field) {
            return {
                'dates': {array: {builtin: '.google.type.Date'}}
            }[field];
        },
        variable: function ({name, goType}) {
            func.body.variables.push({name, type: goType}); // TODO: dupes
            return name;
        },
    }));

    // TODO: put these back. I removed them for smaller output.
    // includePrerendered(goFile);
    // includeStandardImports(goFile);

    console.log(JSON.stringify(goFile, undefined, 4));

    return renderFile(goFile);
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
    return names.normalize(protoName, 'TitleCamelCase');
}

// Return a string containing the Go spelling for the type corresponding to the
// specified `okraType`. For example:
//
// - {builtin: "TYPE_STRING"} → "string"
// - {builtin: "name"} → "string"
// - {enum: "Foo"} → "pb.Foo"
// - {array: "TYPE_INT64"} → "[]int64"
// - {builtin: ".google.protobuf.Timestamp"} → "*timestamp.Timestamp"
// - {array: {builtin: ".google.type.Date"}} → "[]*date.Date"
//
// TODO: This assumes that all enum types are in package alias `pb`. This will 
// not be true in general, which means that this will have to be messier.
function type2go(okraType) {
    if (okraType.array) {
        return `[]${type2go(okraType.array)}`;
    }

    if (okraType.enum) {
        // TODO: see note at top of this function
        return `pb.${messageOrEnum2go(okraType.enum)}`;
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
// error.
//
// If an instruction encounters an error, it will assign to `err` and then
// return using a `return` statement without any arguments. Thus the function
// in which the instruction is expanded must use named return values.

// The following snippet of Go AST occurs in a few places, so here it is once for reuse:
//
//     if err != nil {
//         err = combineErrors(err, tx.rollback())
//         return
//     }
const ifErrRollbackAndReturn = {
    if: {
        condition: {notEqual: {left: {symbol: 'err'}, right: null}},
        body: [
            // err = combineErrors(err, tx.rollback())
            {assign: {
                left: ['err'],
                right: [{call: {
                    function: 'combineErrors',
                    arguments: [
                        {symbol: 'err'},
                        {call: {
                            function: {dot: ['tx', 'rollback']},
                            arguments: []
                        }}
                    ]
                }}]}},

            // return (because an error occurred)
            {return: []}
        ]
}};

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
    //         err = combineErrors(err, tx.rollback())
    //         return
    //     }

    const parameters = instruction.parameters.map(parameter => {
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
        //     err = combineErrors(err, tx.rollback())
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
    //         err = combineErrors(err, tx.rollback())
    //         return
    //     }
    //     
    //     err = rows.Scan($destinations)
    //     if err != nil {
    //         err = combineErrors(err, tx.rollback())
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
        //     err = combineErrors(err, tx.rollback())
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
                                    function: {dot: ['tx', 'rollback']},
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
        //     err = combineErrors(err, tx.rollback())
        //     return
        // }
        ifErrRollbackAndReturn
    ];
}

// Return an array of statements that perform the specified CRUD "read-row"
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
    //             err = combineErrors(err, tx.rollback())
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
                    type: type2go(elementType)
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
                //     err = combineErrors(err, tx.rollback())
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
