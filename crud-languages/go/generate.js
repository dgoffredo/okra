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
            parameters: [{field: 'id'}]
        },
        field2type: function (field) {
            return {
                id: 'TYPE_INT32',
                name: 'TYPE_STRING'
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

    const ast = includePrerendered(goFile);
    console.log(JSON.stringify(ast, undefined, 4));

    return renderFile(ast);
}


// Return the Go struct field name that would be generated for the specified
// `protoFieldName`. The convention for protobuf message fields is to use
// lower_snake_case (but it's not enforced), while the generated Go code uses
// TitleCamelCase, except where parts of the input name had MaybeSomeALLCaps.
function field2go(protoFieldName) {
    return names.normalize(protoFieldName, 'TitleCamelCase');
}

// The following functions, each named "perform ..." (e.g. performQuery,
// performReadRow) translate a CRUD instruction into an array of Go statements
// that are expanded into a Go function to perform the CRUD instruction. There
// is one for each possible CRUD operation.
//
// All of the "perform ..." functions assume that the following variables are
// in scope:
// - `message` is the protobuf message struct being read from or written to.
// - `transaction` is the `sql.Tx` object for the current database transaction.
// - `ctx` is the `context.Context` object describing the current cancellation
//   context.

// Return an array of statements that perform the specified CRUD `instruction`
// in the context implied by the other specified arguments.
function performQuery({
    // the "query" CRUD instruction
    instruction,

    // function that maps a message field name to an okra type
    field2type,

    // function that registers a specified `variable({name, goType})` and returns `name`
    // Note that that variables that are _assumed_ to be in scope, such as
    // `ctx` and `transaction`, don't need to use this function. It's for
    // variables like `err` and `rows`.
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
    //         return err
    //     }

    const parameters = instruction.parameters.map(parameter => {
        if (parameter.field) {
            const type = field2type(parameter.field); // okra type
            const member = field2go(parameter.field); // Go struct field name
            if (type === '.google.protobuf.Timestamp') {
                return {
                    // fromTimestamp(message.someField)
                    call: {
                        function: 'fromTimestamp',
                        arguments: [{dot: ['message', member]}]
                    }
                };
            }
            else if (type === '.google.type.Date') {
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

    // The following code references these two variables.
    variable({name: 'rows', goType: '*sql.Rows'})
    variable({name: 'err', goType: 'error'})

    return [
        // rows, err = transaction.QueryContext(ctx, $query, $parameters)
        {assignment: {
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
        //     return err
        // }
        {if: {
            condition: {notEqual: {left: {symbol: 'err'}, right: null}},
            body: [
                // err = combineErrors(err, tx.rollback())
                {assignment: {
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

                // return err
                {return: [{symbol: 'err'}]}
            ]
        }}
    ]
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

return {generate};

});
