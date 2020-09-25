// This module provides a function, `generate`, that takes:
// - an object as produced by some SQL dialect's `types2crud` function,
// - an array of Okra types, and
// - an object of proto file options (by file)
//
// and returns a string containing Go source code for a package that implements
// the CRUD operations.
define([
    './prerendered',
    './render',
    '../../dependencies/tisch/tisch',
    '../../schemas/schemas',
    '../../lib/names'],
    function (prerendered, {renderFile}, tisch, schemas, names) {

// The code in this file is divided into five sections. Each section is headed
// with a markdown-style comment. Here is a summary of the sections:
//
// - "Generate" contains only the `generate` function, which is the function
//   provided by this module.
// - "CRUD Operations" contains one function for each of the CRUD operations
//   create/read/update/delete. Each function produces the abstract syntax tree
//   (AST) of a function that does the indicated operation for some message type.
// - "CRUD Instructions" contains one function for each of the CRUD
//   instructions that are combined to create the bodies of CRUD operations. An
//   instruction is something like "execute this SQL query." Each function in
//   this section returns an array of statements that can be included as part of
//   the AST returned by one of the functions in the "CRUD Operations" section.
// - "Finishers" contains functions that walk an AST and possibly modify it.
//   For example, there's one function that walks through an AST describing a Go
//   file, identifies references to standard packages, and inserts the
//   appropriate imports.
// - "Utilities" contains everything else. It's a mix of functions and
//   constants used throughout the other sections.

// Generate
// ========
// This section contains the `generate` function, which is the function
// provided by this module.

// Return a string of Go source code for a Go package that implements the CRUD
// operations indicated by the specified parameters:
// - `crud`: an object as produced by some SQL dialect's `types2crud` function
// - `types`: an array of Okra types
// - `options`: an object of proto file options (by file)
function generate({crud, types, options}) {
    return renderFile(generateUnrendered({crud, types, options}));
}

// See `generate` for documentation. This is the implementation except for the
// rendering at the end (AST -> code).
function generateUnrendered({crud, types, options}) {
    // Verify that the arguments have the expected shape.
    // - `crud`
    schemas.crud.enforce(crud);
    // - `types`
    types.forEach(schemas.type.enforce);
    // - `options`
    tisch.compileFunction(({Any, etc}) => ({
        // file path → FileOptions object from protocol buffer compiler
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
        // `imports` is filled out more later
        imports: {
            'database/sql': null,
            'context': null
        },
        declarations: messages.map(message => {
            // Return an object of arguments to pass to one of the functions
            // `funcCreate`, `funcRead`, etc. Which one is determined by
            // `operation`: one of "create", "read", etc.
            function argumentsFor(operation) {
                return {
                    typeName: message.name,
                    // e.g. crud[message.name].create, or .read
                    instructions: crud[message.name][operation],
                    types, 
                    typePackageAlias
                };
            }

            return [
                funcCreate(argumentsFor('create')),
                funcRead(argumentsFor('read')),
                funcUpdate(argumentsFor('update')),
                funcDelete(argumentsFor('delete'))
            ];
        }).flat()
    };

    // Calls to `typePackageAlias` have been helping decide which
    // protobuf-generated Go packages need to be imported and what to call them.
    // `protoImports()` is the result.
    Object.assign(goFile.imports, protoImports());

    // If the functions in `goFile` referenced utility functions, like those
    // used to convert dates and timestamps to/from okra's custom formats,
    // include the definitions of those functions.
    includePrerendered(goFile);

    // Look for references to standard packages, like "fmt," and import them if
    // they aren't already.
    includeStandardImports(goFile);

    return goFile;
}

// CRUD Operations
// ===============
// This section contains one function for each of the CRUD operations
// create/read/update/delete. Each function produces AST of a function that
// does the indicated operation for some message type.

// Return a Go AST node representing a func that creates a new instance of a
// message of the specified `typeName` in the database using the specified CRUD
// `instructions`. Use the specified `types` object of okra types by name to
// inspect the message type and any enum types that it might depend upon. Use
// the specified `typePackageAlias` function to look up which package aliases
// (e.g. "pb", "p2") a given message/enum type belongs to.
function funcCreate({typeName, instructions, types, typePackageAlias}) {
    // Here's what we're going for:
    //
    //     ... documentation ...
    //     func CreateFooBar(ctx context.Context, db *sql.DB, message *pb.FooBar) (err error) {
    //         ... vars ...
    //
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
`${funcName} adds the specified message to the specified db, subject to the
specified cancellation context ctx. Return nil on success, or return a
non-nil value if an error occurs.`;
    const parameters = [
        {name: 'ctx', type: 'context.Context'},
        {name: 'db', type: '*sql.DB'},
        {name: 'message',
         type: `*${typePackageAlias(typeName)}.${messageOrEnum2go(typeName)}`}
    ];
    const results = [{name: 'err', type: 'error'}];
    const variables = [];
    // Begin by starting a transaction. We'll fill out the rest later.
    const statements = [...beginTransaction];
    const func = {
        documentation,
        name: funcName,
        parameters,
        results,
        body: {
            variables,
            statements
        }
    };

    // Define the arguments needed by the instruction handlers.

    // {<fieldName>: <okra type>}
    const typeByField = types[typeName].fields.reduce(
        (byName, {name, type}) => Object.assign(byName, {[name]: type}),
        {});

    // variable({name, goType}) adds the variable with the specified name and
    // having the specified type to the func's variable declarations section if
    // it hasn't been added already, and returns the name of the variable.
    const variable = variableAdder(variables);

    // In a "create" func, all fields are "included," so this always returns
    // `true`.
    function included(fieldName /*ignored*/) {
        return true;
    }

    // `transaction` is a variable assumed to be in scope, so add that first.
    variable({name: 'transaction', goType: '*sql.Tx'});

    // Generate statements that implement each instruction, and append the
    // statements to the body of the func.
    statements.push(...performInstructions({
        instructions,
        typeByField,
        variable,
        included,
        typePackageAlias
    }));

    statements.push(...commitTransactionAndReturn);

    return {function: func};
}

// Return a Go AST node representing a func that reads an instance of a
// message of the specified `typeName` from the database using the specified
// CRUD `instructions`. Use the specified `types` object of okra types by name
// to inspect the message type and any enum types that it might depend upon.
// Use the specified `typePackageAlias` function to look up which package
// aliases (e.g. "pb", "p2") a given message/enum type belongs to.
function funcRead({typeName, instructions, types, typePackageAlias}) {
    // Here's what we're going for:
    //
    //      // ... documentation ...
    //      func ReadFooBar(ctx context.Context, db *sql.DB, message *pb.FooBar) (err error) {
    //         ... vars ...
    //
    //         transaction, err = db.BeginTx(ctx, nil)
    //         if err != nil {
    //             return
    //         }
    //
    //         ... all the instructions ...
    //
    //         err = transaction.Commit()
    //         return
    //      }
    
    const funcName = `Read${messageOrEnum2go(typeName)}`;
    const messageType =
        `${typePackageAlias(typeName)}.${messageOrEnum2go(typeName)}`;

    // {<fieldName>: <okra type>}
    const typeByField = types[typeName].fields.reduce(
        (byName, {name, type}) => Object.assign(byName, {[name]: type}),
        {});

    const documentation =
`${funcName} reads from the specified db into the specified message, where
the ID of the message must be pre-populated by the caller. On success, the
error returned will be nil. On error, the error returned will not be nil.
The specified cancellation context ctx is forwarded wherever appropriate.`;

    const parameters = [
        {name: 'ctx', type: 'context.Context'},
        {name: 'db', type: '*sql.DB'},
        // `message` is a pointer to a protobuf message (of the correct type)
        {name: 'message', type: `*${messageType}`}
    ];
    const results = [
        {name: 'err', type: 'error'}
    ];
    const variables = [];
    const statements = [];
    const func = {
        documentation,
        name: funcName,
        parameters,
        results,
        body: {
            variables,
            statements
        }
    };

    // Define the arguments needed by the instruction handlers.

    // variable({name, goType}) adds the variable with the specified name and
    // having the specified type to the func's variable declarations section if
    // it hasn't been added already, and returns the name of the variable.
    const variable = variableAdder(variables);

    // In a "read" func, all fields are included (I haven't implemented partial
    // record fetching -- no need), so this always returns `true`.
    function included(fieldName /*ignored*/) {
        return true;
    }

    // `transaction` is a variable assumed to be in scope, so add that first.
    variable({name: 'transaction', goType: '*sql.Tx'});

    // Begin by assigning a default value to `message` (the return
    // value). Then start a transaction.
    statements.push(
        // transaction, err = db.BeginTx(ctx, nil)
        // if err != nil {
        //     return
        // }
        ...beginTransaction
    );

    // Generate statements that implement each instruction, and append the
    // statements to the body of the func.
    statements.push(...performInstructions({
        instructions,
        typeByField,
        variable,
        included,
        typePackageAlias
    }));

    statements.push(...commitTransactionAndReturn);

    return {function: func};
}

// Return a Go AST node representing a func that updates an instance of a
// message of the specified `typeName` from the database using the specified
// CRUD `instructions`. Use the specified `types` object of okra types by name
// to inspect the message type and any enum types that it might depend upon.
// Use the specified `typePackageAlias` function to look up which package
// aliases (e.g. "pb", "p2") a given message/enum type belongs to.
function funcUpdate({typeName, instructions, types, typePackageAlias}) {
    // Here's what we're going for:
    //
    // // UpdateFooBar updates within the specified db the fields of the specified
    // // message that are indicated by the specified fieldMask, subject to
    // // specified cancellation context ctx. Each element of fieldMask is the
    // // name of a field in message whose value is to be used in the database
    // // update. If fieldMask is empty or nil, then update all fields from
    // // message. Return nil on success, or a non-nil error if an error occurs.
    // func UpdateFooBar(ctx context.Context, db *sql.DB, message pb.FooBar, fieldMask []string) (err error) {
    //     ... other vars ...
    //     var fieldMaskMap map[string]bool
    //     var included func(string) bool
    //
    //     if len(fieldMask) == 0 {
    //         included = func(string) bool {
    //             return true
    //         }
    //     }
    //     else {
    //         fieldMaskMap = make(map[string]bool, len(fieldMask))
    //         for _, field := range fieldMask {
    //             fieldMaskMap[field] = true
    //         }
    //         included = func(field string) bool {
    //             return fieldMaskMap[field]
    //         }
    //     }
    //
    //     ... instructions ...
    // }

    const funcName = `Update${messageOrEnum2go(typeName)}`;
    const messageType =
        `${typePackageAlias(typeName)}.${messageOrEnum2go(typeName)}`;

    // {<fieldName>: <okra type>}
    const typeByField = types[typeName].fields.reduce(
        (byName, {name, type}) => Object.assign(byName, {[name]: type}),
        {});

    const documentation =
`${funcName} updates within the specified db the fields of the specified
message that are indicated by the specified fieldMask, subject to
specified cancellation context ctx. Each element of fieldMask is the
name of a field in message whose value is to be used in the database
update. If fieldMask is empty or nil, then update all fields from
message. Return nil on success, or a non-nil error if an error occurs.`;

    const parameters = [
        {name: 'ctx', type: 'context.Context'},
        {name: 'db', type: '*sql.DB'},
        {name: 'message', type: `*${messageType}`},
        {name: 'fieldMask', type: '[]string'}
    ];
    const results = [
        {name: 'err', type: 'error'}
    ];
    const variables = [];
    const statements = [];
    const func = {
        documentation,
        name: funcName,
        parameters,
        results,
        body: {
            variables,
            statements
        }
    };

    // Define the arguments needed by the instruction handlers.

    // variable({name, goType}) adds the variable with the specified name and
    // having the specified type to the func's variable declarations section if
    // it hasn't been added already, and returns the name of the variable.
    const variable = variableAdder(variables);

    // A variable `included` of function type will be in scope. The generated
    // code checks whether a field is included by invoking a local function
    // (`included`), specifying the name of the field as the function argument.
    //
    // If `included` is never referenced by the generated code, then it doesn't
    // need to be defined, so also keep track of whether `included` has ever
    // been called.
    let defineInclusionBoilerplate = false;

    function included(fieldName) {
        defineInclusionBoilerplate = true;

        return {
            call: {
                function: 'included',
                arguments: [fieldName] // the literal string, quoted
            }
        };
    }

    // `transaction` is a variable assumed to be in scope, so add that first.
    variable({name: 'transaction', goType: '*sql.Tx'});

    statements.push(...beginTransaction);

    // Generate statements that implement each instruction, and append the
    // statements to the body of the func.
    statements.push(...performInstructions({
        instructions,
        typeByField,
        variable,
        included,
        typePackageAlias
    }));

    statements.push(...commitTransactionAndReturn);

    // If `performInstructions`, above, made any calls to `included`, then we
    // need to emit statements that set up the lookup map of field names that
    // are included in the update. Prepend those statements to `statements`.
    //
    // When would an update function _not_ call `included`? Whenever the
    // message type consists of only an ID field. Unlikely, but possible, and
    // if we have unused variables in the generated Go code, it won't compile.
    if (defineInclusionBoilerplate) {
        statements.splice(0, 0, ...inclusionBoilerplate(variable));
    }

    return {function: func};
}

// Return a Go AST node representing a func that deletes an instance of a
// message of the specified `typeName` from the database using the specified
// CRUD `instructions`. Use the specified `types` object of okra types by name
// to inspect the message type and any enum types that it might depend upon.
// Use the specified `typePackageAlias` function to look up which package
// aliases (e.g. "pb", "p2") a given message/enum type belongs to.
function funcDelete({typeName, instructions, types, typePackageAlias}) {
    // Here's what we're going for:
    //
    // // DeleteFooBar deletes the message having the specified id from the specified
    // // db, subject to the specified cancellation context ctx. On success, the error
    // // returned will be nil. On error, the error returned will not be nil. It is
    // // not considered an error if there is no message having the specified id in
    // // the database; i.e. deletions are idempotent.`;
    // func DeleteFooBar(ctx context.Context, db *sql.DB, id int64) error {
    //     ... other vars ...
    //
    //     var message pb.FooBar
    //     message.Id = id
    //
    //     ... instructions ...
    // }

    // {<fieldName>: <okra type>}
    const typeByField = types[typeName].fields.reduce(
        (byName, {name, type}) => Object.assign(byName, {[name]: type}),
        {});

    const funcName = `Delete${messageOrEnum2go(typeName)}`;
    const documentation =
`${funcName} deletes the message having the specified id from the specified
db, subject to the specified cancellation context ctx. On success, the error
returned will be nil. On error, the error returned will not be nil. It is
not considered an error if there is no message having the specified id in
the database; i.e. deletions are idempotent.`;
    const idFieldName = types[typeName].idFieldName;
    const parameters = [
        {name: 'ctx', type: 'context.Context'},
        {name: 'db', type: '*sql.DB'},
        // `id` has whatever Go type corresponds to the designated ID field of
        // the message type.
        {name: 'id',
         type: type2go({
            okraType: typeByField[idFieldName],
            typePackageAlias
        })}
    ];
    const results = [{name: 'err', type: 'error'}];
    const variables = [];

    // variable({name, goType}) adds the variable with the specified name and
    // having the specified type to the func's variable declarations section if
    // it hasn't been added already, and returns the name of the variable.
    const variable = variableAdder(variables);

    // The CRUD instructions are defined in terms of fields of a message type,
    // so even if we just need to specify an ID value, it's simpler to have a
    // full message object that contains just the ID value.
    const messageType =
        `${typePackageAlias(typeName)}.${messageOrEnum2go(typeName)}`;
    variable({name: 'message', goType: messageType});

    const statements = [
        // message.Id = id
        {assign: {
            left: [{dot: ['message', field2go(idFieldName)]}],
            right: [{symbol: 'id'}]
        }},

        ...beginTransaction
    ];
    const func = {
        documentation,
        name: funcName,
        parameters,
        results,
        body: {
            variables,
            statements
        }
    };

    // In a "delete" func, no fields are referenced, so it's an error if
    // `included` is called.
    function included(fieldName) {
        throw Error('funcDelete processed an instruction that queried ' +
            'whether a field is included, but instructions in a deletion ' +
            'operation should not have to reference any fields. fieldName: ' +
            fieldName);
    }

    // `transaction` is a variable assumed to be in scope, so add that first.
    variable({name: 'transaction', goType: '*sql.Tx'});

    // Generate statements that implement each instruction, and append the
    // statements to the body of the func.
    statements.push(...performInstructions({
        instructions,
        typeByField,
        variable,
        included,
        typePackageAlias
    }));

    statements.push(...commitTransactionAndReturn);

    return {function: func}
}

// CRUD Instructions
// =================
// This section contains one function for each of the CRUD instructions that
// are combined to create the bodies of CRUD operations. An instruction is
// something like "execute this SQL query." Each function in this section
// returns an array of statements that can be included as part of the AST
// returned by one of the functions in the "CRUD Operations" section.
//
// All of these functions assume that the following Go variables are in scope:
// - `message` is the protobuf message struct being read from or written to.
//   It might be a pointer to a message or the message itself, depending on
//   the operation.
// - `transaction` is the `*sql.Tx` object for the current database transaction.
// - `ctx` is the `context.Context` object describing the current cancellation
//   context.
// - `err` is the `error` variable to assign to before returning due to an
//   error.
//
// Additionally, the functions might depend on any of the following variables,
// but will say so by invoking their `variable` parameter first (i.e. these are
// not assumed to be in scope, but will be if indicated by a call to
// `variable`):
// - `parameters` is a `[]interface{}` used when specifying a variable number
//   of parameters to a SQL command (such as the "exec-with-tuples"
//   instruction).
// - `rows` is a `*sql.Rows` used when iterating through SQL query results.
// - `ok` is `bool` used to capture the success or failure of `rows.Next()`.
// - `fieldMaskMap` is a `map[string]bool` for looking up whether a particular
//   message field is included in the current operation.
// - `included` is a `func(string)bool` that generalizes `fieldMaskMap` to
//   support the "everything is included" case.
//
// If an instruction encounters an error, it will assign to `err` and then
// return using a `return` statement without any arguments. Thus the function
// in which the instruction is expanded must use named return values.

// Return an array of statements that perform the specified CRUD "query"
// `instruction` in the context implied by the other specified arguments.
function performQuery({
    // the "query" CRUD instruction
    instruction,

    // object that maps a message field name to an okra type
    typeByField,

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
    //         return
    //     }
    //     ok = rows.Next()

    const parameters = inputParameters2expressions({
        parameters: instruction.parameters,
        typeByField,
        included
    });

    // The following code references these variables.
    variable({name: 'rows', goType: '*sql.Rows'})
    variable({name: 'ok', goType: 'bool'})

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
        //     return
        // }
        ifErrReturn,

        // ok = rows.Next()
        {assign: {
            left: ['ok'],
            right: [{
                call: {
                    function: {dot: ['rows', 'Next']},
                    arguments: []
                }
            }]
        }}
    ]
}

// Return an array of statements that perform the specified CRUD "read-row"
// `instruction` in the context implied by the other specified arguments.
function performReadRow({
    // the "read-row" CRUD instruction
    instruction,

    // object that maps a message field name to an okra type
    typeByField,

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
    //     if !ok {
    //         err = nowRow()
    //         return
    //     }
    //     
    //     err = rows.Scan($destinations)
    //     if err != nil {
    //         return
    //     }
    //     rows.Next()
    //
    const destinations = instruction.destinations.map(destination => {
        const type = typeByField[destination.field]; // okra type
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
        // if !ok {
        //     err = noRow()
        //     return
        // }
        {if: {
            condition: {not: {symbol: 'ok'}},
            body: [
                {assign: {
                    left: ['err'],
                    right: [{
                        call: {function: 'noRow', arguments: []}
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
        //     return
        // }
        ifErrReturn,

        // rows.Next()
        {call: {
            function: {dot: ['rows', 'Next']},
            arguments: []}}
    ];
}

// Return an array of statements that perform the specified CRUD "read-array"
// `instruction` in the context implied by the other specified arguments.
function performReadArray({
    // the "read-array" CRUD instruction
    instruction,

    // object that maps a message field name to an okra type
    typeByField,

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
    //     for ; ok; ok = rows.Next() {
    //         var temp whateverGoType
    //         err = rows.Scan(&temp) // might use intoDate or intoTimestamp
    //         if err != nil {
    //             return
    //         }
    //         $destination = append($destination, temp)
    //     }

    // For each row, we scan one array element into a temporary variable
    // `temp`. The expression that we pass to `rows.Scan` depends on the type
    // of the destination array. `intoTemp` is that expression.
    // If the field is an array, then the element type is `.array`. Otherwise,
    // it's a FieldMask as so the element type is string.
    const fieldType = typeByField[instruction.destination.field];
    const elementType = fieldType.array || {builtin: 'TYPE_STRING'};
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

    // If the destination is an array, then we append to it using the `append`
    // function. If it's a FieldMask, then we append to it using `appendField`
    // (which we defined).
    const appendFunctionName = fieldType.array ? 'append' : 'appendField';

    // the array we're appending to
    const destinationGoArray = {
        dot: ['message', field2go(instruction.destination.field)]
    };

    // The following code references this variable.
    variable({name: 'rows', goType: '*sql.Rows'});

    return [{
        // for ; ok; ok = rows.Next() {
        iterationFor: {
            condition: {symbol: 'ok'},
            post: {assign: {
                left: ['ok'],
                right: [{
                    call: {
                        function: {dot: ['rows', 'Next']},
                        arguments: []
                    }
                }]}},
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
                //     return
                // }
                ifErrReturn,

                // $destination = append($destination, temp)
                // or
                // $destination = appendField($destination, temp)
                {assign: {
                    left: [destinationGoArray],
                    right: [{
                        call: {
                            function: appendFunctionName,
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

    // object that maps a message field name to an okra type
    typeByField,

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
    //         return
    //     }
    //
    // or, if there's a "condition," wrap the above in an `if` statement.

    const parameters = inputParameters2expressions({
        parameters: instruction.parameters,
        typeByField,
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
        //     return
        // }
        ifErrReturn
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

// Return an array of statements that perform the specified CRUD
// "exec-with-tuples" `instruction` in the context implied by the other
// specified arguments.
function performExecWithTuples({
    // the "exec-with-tuples" CRUD instruction
    instruction,

    // object that maps a message field name to an okra type
    typeByField,

    // function that registers a specified `variable({name, goType})` and returns `name`
    // Note that that variables that are _assumed_ to be in scope, such as
    // `ctx` and `transaction`, don't need to use this function. It's for
    // variables like `rows` and `ok`.
    variable,

    // function that returns an expression for whether a field is included in the CRUD operation
    included
}) {
    // Verify that exactly one of the `instruction.parameters` has array or
    // FieldMask type.
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

    const arrayLikes = instruction.parameters.filter(parameter => {
        const parameterType = typeByField[parameter.field];
        return parameterType.array ||
            parameterType.builtin === '.google.protobuf.FieldMask';
    });

    if (arrayLikes.length !== 1) {
        throw Error(`Expected "exec-with-tuples" parameters to contain ` +
            `exactly one array-valued or FieldMask field, but found ` + 
            `${arrayLikes.length}: ` + JSON.stringify(arrayLikes));
    }

    const [arrayLikeField] = arrayLikes.map(parameter => parameter.field);
    
    // If the `arrayLikeField` is an array, then we can `range` loop over it
    // normally, and we can get its length using `len`. If it's a FieldMask,
    // though, then we need to `range` loop over its `.Paths` field, and we
    // query its length using `fieldMaskLen` (which we defined).
    const arrayLikeType = typeByField[arrayLikeField];
    const lenFunctionName = arrayLikeType.array ? 'len' : 'fieldMaskLen';
    const rangeArgumentParts = arrayLikeType.array
        ? ['message', field2go(arrayLikeField)] // e.g. message.Pets
        : ['message', field2go(arrayLikeField), 'Paths'] // e.g. messages.MustHaves.Paths

    // Here's what we're going for:
    //
    //     if $included && $lenFunctionName($array) != 0 {
    //         parameters = nil // clear the slice
    //
    //         for _, element := range $rangeArgument {
    //             parameters = append(parameters, [...], element, [...])
    //         }
    //
    //         _, err = transaction.ExecContext(
    //             ctx,
    //             withTuples($sql, $tuple, $lenFunctionName($array)),
    //             parameters...)
    //
    //         if err != nil {
    //             return
    //         }
    //     }

    // The following code references this variable.
    variable({name: 'parameters', goType: '[]interface{}'});

    const arrayLengthExpression = {
        call: {
            function: lenFunctionName,
            arguments: [
                {dot: ['message', field2go(arrayLikeField)]}
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
                    sequence: {dot: rangeArgumentParts},
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
                                    // will be `element` (the one
                                    // array/FieldMask field), while the rest
                                    // will be the other fields repeated again
                                    // this time around the loop.
                                    ...instruction.parameters.map(parameter => {
                                        if (parameter.field === arrayLikeField) {
                                            return {symbol: 'element'};
                                        }
                                        else {
                                            return inputParameter2expression({
                                                parameter,
                                                typeByField,
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
                //     return
                // }
                ifErrReturn
            ]
        }}
    ];
}

// Finishers
// =========
// This section contains functions that walk an AST and possibly modify it. For
// example, there's one function that walks through an AST describing a Go
// package, and identifies references to standard packages, and inserts the
// appropriate imports.

// Search through the specified `goFile` AST for references to pre-rendered
// functions. Add imports and toplevel declarations to `goFile` as necessary to
// satsify those references. Return `goFile`. Note that `goFile` is modified in
// place.
function includePrerendered(goFile) {
    const referenced = {}; // set of function names

    function visit(node) {
        // Here's a reminder of the shape of a "call" AST node:
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
        // Here's a reminder of the shape of a "call" AST node:
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

// Utilities
// =========
// This section contains everything else. It's a mix of functions and constants
// used throughout the other sections.

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
// `.protoImports()` will differ (e.g. "a" → "pb", "b" → "pb2"; versus "b" →
// "pb", "a" → "pb2").
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
            const fullPackageName = fileOptions.goPackage.split(';')[0];
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

// `beginTransaction` is an array of Go statements common to all CRUD
// operations. It begins a database transaction and returns an error if that
// fails. It also ends with a "spacer" to set it apart from whatever
// statements might follow.
//
//     transaction, err = db.BeginTx(ctx, nil)
//     if err != nil {
//         return
//     }
//
const beginTransaction = Object.freeze([
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
]);

// `commitTransactionAndReturn` is an array of Go statements common to all
// CRUD operations. It commits a database transaction and returns.
//
//     err = transaction.Commit()
//     return
//
const commitTransactionAndReturn = Object.freeze([
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
    {return: []}
]);

// Return an array of Go statements that set up local variables used to keep
// track of which variables are "included" in the current CRUD operation. Use
// the specified `variable` to register local variables.
function inclusionBoilerplate(variable) {
    // These are the variables used to check whether a field is "included".
    variable({name: 'fieldMaskMap', goType: 'map[string]bool'});
    variable({name: 'included', goType: 'func(string) bool'});

    // Set up the "included" function, whose form depends on whether the
    // `fieldMask` parameter is empty.
    //
    //     if len(fieldMask) == 0 {
    //         included = func(string) bool {
    //             return true
    //         }
    //     }
    //     else {
    //         fieldMaskMap = make(map[string]bool, len(fieldMask))
    //         for _, field := range fieldMask {
    //             fieldMaskMap[field] = true
    //         }
    //         included = func(field string) bool {
    //             return fieldMaskMap[field]
    //         }
    //     }
    const lenOfFieldMask = {call: {
        function: 'len',
        arguments: [{symbol: 'fieldMask'}]}};

    return [{if: {
        // if len(fieldMask) == 0 {
        condition: {equal: {
            left: lenOfFieldMask,
            right: 0}},

        //     included = func(string) bool {
        //         return true
        //     }
        body: [{assignFunc: {
            left: 'included',
            parameters: [{type: 'string'}],
            results: [{type: 'bool'}],
            body: [{
                return: [true]
            }]
        }}],
        // else {
        elseBody: [
            // fieldMaskMap = make(map[string]bool, len(fieldMask))
            {assign: {
                left: ['fieldMaskMap'],
                right: [{call: {
                    function: 'make',
                    arguments: [
                        {symbol: 'map[string]bool'},
                        lenOfFieldMask
                    ]}}]
            }},

            // for _, field := range fieldMask {
            //     fieldMaskMap[field] = true
            // }
            {rangeFor: {
                variables: ['_', 'field'],
                sequence: {symbol: 'fieldMask'},
                body: [{assign: {
                    left: [{index: {
                        object: 'fieldMaskMap',
                        index: {symbol: 'field'}
                    }}],
                    right: [true]
                }}]
            }},

            // included = func(field string) bool {
            //     return fieldMaskMap[field]
            // }
            {assignFunc: {
                left: 'included',
                parameters: [{name: 'field', type: 'string'}],
                results: [{type: 'bool'}],
                body: [{return: [
                    {index: {
                        object: 'fieldMaskMap',
                        index: {symbol: 'field'}
                    }}
                ]}]
            }}
        ]}},

        {spacer: 1}
    ];
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
    // `basename` is e.g. for ".foo.bar.Baz" → "Baz"
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
        const packageAlias = typePackageAlias(okraType.enum);
        return `${packageAlias}.${enumName}`;
    }

    // See `builtin.tisch.js`.
    return {
        '.google.protobuf.Timestamp': '*timestamp.Timestamp',
        '.google.protobuf.FieldMask': '*field_mask.FieldMask',
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

// `cleanupFunctions` associates Go variables with functions that "clean them
// up." Each key in `cleanupFunctions` is a JSON-serialized name/type pair, and
// the values of `cleanupFunctions` are Go AST nodes describing the body of a
// function (just the body) that can be deferred to clean up the variable.
//
// For example, if `file` is a `*os.File`, then `file.Close()` could be
// deferred using the following statement:
//
//     defer func() {
//         file.Close()
//     }()
//
// That would correspond to an entry in `cleanupFunctions` with the key
// `JSON.stringify(['file', '*os.File'])` and the value:
//
//     [{
//         call: {
//             function: {dot: ['file', 'Close']},
//             arguments: []
//         }
//     }]
//
// Note that the value is an array, even if it contains only one statement.
const cleanupFunctions = {
    // When an error occurrs, we want to rollback the current transaction.
    //
    //     if err != nil && transaction != nil {
    //         err = combineErrors(err, transaction.Rollback())
    //     }
    [JSON.stringify(['transaction', '*sql.Tx'])]: [{
        if: {
            condition: {and: {
                left: {notEqual: {left: {symbol: 'err'}, right: null}},
                right: {notEqual: {left: {symbol: 'transaction'}, right: null}}}},
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
                    }}]}}
            ]
    }}],

    // `sql.Rows.Close()` must be called if the `Rows` were not exhausted by
    // calls to `.Next()`, even if we subsequently rollback the associated
    // transaction due to an error (in fact, attempting to do so without first
    // calling `Rows.Close()` will poison the underlying database connection).
    // `deferCleanupRows` is an array of Go statement that can appear in a
    // deferred function to cleanup a variable named `rows`.
    //
    //     if rows != nil {
    //         rows.Close()
    //     }
    [JSON.stringify(['rows', '*sql.Rows'])]: [{
        if: {
            condition: {
                notEqual: {
                    left: {symbol: 'rows'},
                    right: null
                }
            },
            body: [{
                call: {
                    function: {dot: ['rows', 'Close']},
                    arguments: []}
            }]
        }
    }]
};

// Return a `function ({name, goType})` that adds the variable with the
// specified `name` and having the specified `goType` to `variables` if it
// hasn't been added already. Additionally, if the variable's name and type
// are associated with a cleanup function, a defer statement invoking the
// cleanup function will be appended to the specified `statements`. Which
// variables have cleanup functions is determined by the `cleanupFunctions`
// global object.
function variableAdder(variables) {
    const alreadyDeclared = {};

    return function({name, goType}) {
        if (name in alreadyDeclared) {
            return name;
        }

        // This is the first time we've seen this variable. Add it to the
        // func's variable declarations.
        const variable = {
            name,
            type: goType
        };

        // If there's a cleanup function registered for this name/type pair,
        // then include it as well.
        const body = cleanupFunctions[JSON.stringify([name, goType])];
        if (body !== undefined) {
            variable.defer = body;
        }

        variables.push(variable);
        alreadyDeclared[name] = true;
        return name;
    };
}

// Return an a Go AST expressions for the specified `parameter` that can appear
// as input parameters to database methods like `Query` and `Exec`. This code
// is common to relevant CRUD instructions.
function inputParameter2expression({parameter, typeByField, included}) {
    if (parameter.field) {
        const type = typeByField[parameter.field]; // okra type
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

    // object that maps a message field name to an okra type
    typeByField,

    // function that returns an expression for whether a field is included in the CRUD operation
    included
}) {
    return parameters.map(parameter => 
        inputParameter2expression({parameter, typeByField, included}));
}

// Return an array of statements that perform each of the specified
// `instructions`, one after the other, in the context implied by the other
// specified arguments.
function performInstructions({
    // array of CRUD instruction
    instructions,

    // object that maps a message field name to an okra type
    typeByField,

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
            typeByField,
            variable,
            included,
            typePackageAlias
        });

        // Append a blank line to separate from the next set of statements.
        statements.push({spacer: 1});
        return statements;
    }).flat();
}

// This snippet of Go code is used a lot, so here it is for reuse.
const ifErrReturn = {
    if: {
        condition: {
            notEqual: {
                left: {symbol: 'err'},
                right: null
            }
        },
        body: [{
            return: []
        }]
    }
};

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

return {
    generate,
    generateUnrendered // for testing
};

});
