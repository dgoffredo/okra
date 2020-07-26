// This module exports a function, `types2crud`, that produces a description of
// create-read-update-delete (CRUD) operations for a given set of types and
// their legends. The SQL statements used in the CRUD instructions are
// compatible with MySQL 5.6.

define(['../../schemas/schemas', '../../dependencies/tisch/tisch', './quote'],
function (schemas, tisch, quote) {
'use strict';

const {quoteName} = quote;

// Return a `RegExp` object compiled from a pattern that is the disjunction of
// the patterns of the specified `regexes`. The "global" flag ("g") will be
// used.
function combinePatterns(...regexes) {
    const pattern = regexes.map(regex => `(${regex.source})`).join('|');
    const flags = 'g';
    return new RegExp(pattern, flags);
}

// Return a modified version of the specified `sqlText` that has had
// unnecessary whitespace removed. This allows SQL template strings to be
// formatted however is convenient in this code, and then reduced to something
// consistent for output.
const sqline = (function () {
    const regex = combinePatterns(
        /\s+/, // whitespace
        /'[^']*'/, // 'single-quoted string'
        /`[^`]*`/, // `backtick-quoted string`
        /"[^"]*"/, // "double-quoted string"
        /--[^\n]*\n/, // -- line comment
        /\/\*(\*[^/]|[^*])*\*\//); // /* block comment */

    const dedupeWhitespace = token => token.match(/^\s+$/) ? ' ' : token;

    return sqlText => sqlText.replace(regex, dedupeWhitespace).trim();
}());

// In a simpler world, selecting the value from a column would always look like:
//
//     select `foo` from ...
//
// and the SQL driver would marshal the value into the corresponding type in
// the generated Go/Python/C++/etc. code. However, SQL drivers (and the
// libraries that wrap them) differ in how they handle certain types. For
// example, in one Go MySQL driver, a "parseTime" parameter must be specified
// in the database connection string in order for datetime values to be
// handled in terms of Go's `time.Time` type. Otherwise they're handled as
// strings.
//
// Also in an ideal world, references to parameters would always look like:
//
//     insert into foo(bar, baz) values(?, ?);
//
// For the same reason, though, the form of the parameter might differ between
// drivers, e.g. it might have to be:
//
//     insert into foo(bar, baz) values(?, from_unixtime(?));
//
// Because of this, we customize how columns are selected ("selector") and how
// parameters are referenced ("parameter") based on the type of the relevant
// protobuf field. Okra picks a convention for the representation of certain
// types, so that Go/Python/C++/etc. code generators can target that
// representation regardless of which particular database driver library they
// use.
function selector({columnName, fieldType}) {
    if (fieldType.builtin === '.google.protobuf.Timestamp') {
        // timestamp(6) → unix timestamp in microseconds
        return `unix_timestamp(${quoteName(columnName)}) * 1000000`;
    }
    else if (fieldType.builtin === '.google.type.Date') {
        // date -> "YYYY-MM-DD"
        // but this is the default for MySQL 5.6
        return quoteName(columnName);
    }
    else {
        return quoteName(columnName);
    }
}

// `fieldType` has the shape of the "type" of a "field" in a message type. See
// `type.tisch.js`.
function parameter(fieldType) {
    if (fieldType.builtin === '.google.protobuf.Timestamp') {
        // unix timestamp in microseconds → timestamp(6) compatible string
        // The intermediate cast to `decimal(20, 6)` ensures that there is
        // enough precision.
        return 'from_unixtime(cast(? / 1000000.0 as decimal(20, 6)))'
    }
    else if (fieldType.builtin === '.google.type.Date') {
        // "YYYY-MM-DD" -> date
        // but this is the default for MySQL 5.6
        return '?';
    }
    else {
        return '?';
    }
}

// Return a CRUD instruction for adding values into the specified
// `arrayTableName` from the specified `arrayField` of the message type having
// the specified `messageIdField`, where the `messageIdField` has the
// specified `messageIdFieldType` and the elements of the array field have the
// specified `arrayFieldType`. The returned instruction will require that
// `arrayField` is included in the operation (if `arrayField` is not included,
// a code generator will not perform the instruction).
function instructionInsertArray({
    arrayTableName,
    messageIdField,
    messageIdFieldType,
    arrayField,
    arrayFieldType
}) {
    return {
        instruction: 'exec-with-tuples',
        condition: {included: arrayField},
        tuple: `(${parameter(messageIdFieldType)}, ${parameter(arrayFieldType)})`,
        sql: sqline(`insert into
            ${quoteName(arrayTableName)}(
                ${quoteName('id')}, ${quoteName('value')})
            values `),
        parameters: [
            {field: messageIdField},
            {field: arrayField}
        ]
    };
}

// Return a CRUD instruction for selecting rows from the specified
// `arrayTableName` representing an array of the specified `arrayType` in the
// message type having the specified `messageIdField` with the specified
// `messageIdFieldType`.
function instructionSelectArray({
    arrayTableName,
    arrayType, // type of the array itself, e.g. `{array: ...}`
    messageIdField,
    messageIdFieldType
}) {
    return {
        instruction: 'query',

        // It's important that we select only the `value` column. Or, at the
        // very least, the `value` column has to be the first column selected,
        // so that the generated code then knows which column in the result set
        // to use as a value in the array field.
        sql: sqline(`select ${selector({columnName: 'value', fieldType: arrayType.array})}
                from ${quoteName(arrayTableName)}
                where ${quoteName('id')} = ${parameter(messageIdFieldType)};`),
        parameters: [
            {field: messageIdField}
        ]
    };
}

// Return a CRUD instruction that deletes all rows from the specified
// `arrayTableName` whose message ID column ("id") of the specified type
// `messageIdFieldType` has the same value as the specified `messageIdField`
// (`messageIdField` is the _name_ of the field whose value we're interested
// in). Optionally specify a `conditionField`, which makes the returned
// instruction applicable only if that field is included in the relevant
// operation (e.g. deleting values before replacing them in an "update," but
// only if we're updating that field).
function instructionDeleteArray({
    arrayTableName,
    messageIdField,
    messageIdFieldType,
    conditionField
}) {
    return {
        instruction: 'exec',
        sql: sqline(`delete from ${quoteName(arrayTableName)}
                where ${quoteName('id')} = ${parameter(messageIdFieldType)};`),
        parameters: [
            {field: messageIdField}
        ],
        // "condition" is optional. Let it appear only if it has a value.
        ...(conditionField ? {condition: {included: conditionField}} : {})
    };
}

// Return a CRUD instruction that selects the scalar fields of an instance of
// the specified `type` from the database. Use the specified `legend` to map
// message fields to table columns.
function instructionSelectMessage({type, legend}) {
    const {scalarFieldSources} = byMultiplicity(legend.fieldSources);
    const keyColumnName = scalarFieldSources
        .find(({fieldName}) => fieldName === type.idFieldName)
        .columnName;
    const fieldTypes = Object.fromEntries(
        type.fields.map(({name, type}) => [name, type]));
    const selectors = scalarFieldSources
        .map(({columnName, fieldName}) =>
            selector({columnName, fieldType: fieldTypes[fieldName]}));
    const idFieldType = fieldTypes[type.idFieldName];

    return {
        instruction: 'query',
        sql: sqline(`select ${selectors.join(', ')}
            from ${quoteName(legend.tableName)}
            where ${quoteName(keyColumnName)} = ${parameter(idFieldType)};`),
        parameters: [
            {field: type.idFieldName}
        ]
    };
}

// Return a snippet of SQL that sets the value at the specified `columnName`
// to either a parameterized value or to itself (a no-op) depending on a
// parameterized boolean. The boolean says whether to update the column. The
// SQL snipped returned by this function is intended to be used as one of the
// "..." in "update foo set ..., ..., ...".
function sqlClauseUpdateColumn({columnName, fieldType}) {
    const name = quoteName(columnName);

    // The first parameter will be bound to a predicate answering the question
    // of whether `columnName` should be updated. The second parameter will be
    // bound to the new value for `columnName`, or to anything (e.g. null) if
    // the column is not to be updated.
    const boolParameter = parameter({builtin: 'TYPE_BOOL'});
    const valueParameter = parameter(fieldType);
    return `${name} = case
        when ${boolParameter} then ${valueParameter}
        else ${name}
      end`;
}

// Return a CRUD instruction that updates the scalar fields of an instance of
// the specified `type` in the database, or return `undefined` if `type` does
// not have any updatable fields. Use the specified `legend` to map message
// fields to table columns.
function instructionUpdateMessage({type, legend}) {
    const {scalarFieldSources} = byMultiplicity(legend.fieldSources);
    const keyColumnName = scalarFieldSources
        .find(({fieldName}) => fieldName === type.idFieldName)
        .columnName;
    const fieldTypes = Object.fromEntries(
        type.fields.map(({name, type}) => [name, type]));
    const idFieldType = fieldTypes[type.idFieldName];

    // Exclude the ID field from those that we might update (we're never going
    // to change the primary key of a row), and also add the type of each field
    // (for use by `sqlClauseUpdateColumn`).
    const scalarFieldInfos = scalarFieldSources
        .filter(({fieldName}) => fieldName !== type.idFieldName)
        .map(entry => ({...entry, fieldType: fieldTypes[entry.fieldName]}));

    if (scalarFieldSources.length === 0) {
        return;
    }

    return {
        instruction: 'exec',
        sql: sqline(`update ${quoteName(legend.tableName)}
            set ${scalarFieldInfos.map(sqlClauseUpdateColumn).join(', ')}
            where ${quoteName(keyColumnName)} = ${parameter(idFieldType)};`),
        parameters: [
            // Each of the possibly-updated fields has two parameters: one that's a
            // boolean saying whether to update it, and another that's the new
            // value if it's to be updated.
            ...scalarFieldInfos.map(({fieldName}) => [
                {included: fieldName},
                {field: fieldName}
            ]).flat(),

            // The last parameter is the primary key of the message, for the
            // `where` clause in the `update` statement.
            {field: type.idFieldName}
        ]
    };
}

// Deal the specified `fieldSources` array into two arrays: one for scalar
// fields, and the other for array fields.
function byMultiplicity(fieldSources) {
    // We can distinguish scalar fields (e.g. int32, string) from array fields
    // (e.g. repeated int32) by the presence of a "tableName" property in the
    // corresponding element of the type's legend's `.fieldSources`. Values of
    // array fields are stored in dedicated tables, so they're associated with
    // a "tableName", while scalar fields are not (they're stored in the
    // message type's table).
    return {
        scalarFieldSources: fieldSources.filter(source => !('tableName' in source)),
        arrayFieldSources: fieldSources.filter(source => 'tableName' in source)
    };
}

//    _____                _       
//   / ____|              | |      
//  | |     _ __ ___  __ _| |_ ___ 
//  | |    | '__/ _ \/ _` | __/ _ \
//  | |____| | |  __/ (_| | ||  __/
//   \_____|_|  \___|\__,_|\__\___|
// 
// Return an array of CRUD instructions that add a new instance of the specified
// `type` to the database. Use the specified `legend` to map message fields to
// table columns.
function instructionsCreateMessage({type, legend}) {
    const {
        scalarFieldSources,
        arrayFieldSources
    } = byMultiplicity(legend.fieldSources);

    const fieldTypes = Object.fromEntries(
        type.fields.map(({name, type}) => [name, type]));
    const scalarFieldInfos = scalarFieldSources
        .map(entry => ({...entry, fieldType: fieldTypes[entry.name]}));

    return [
        // Insert a new row into the table of the message type, specifying
        // all non-array fields.
        {
            instruction: 'exec',
            sql: sqline(`insert into ${quoteName(legend.tableName)}(
                ${scalarFieldSources.map(({columnName}) => quoteName(columnName)).join(', ')})
                values (${scalarFieldInfos.map(parameter).join(', ')});`),
            parameters: scalarFieldSources.map(({fieldName}) => ({field: fieldName}))
        },

        // For each array field, add rows to the corresponding table.
        ...arrayFieldSources.map(({fieldName, tableName}) =>
            instructionInsertArray({
                arrayTableName: tableName,
                messageIdField: type.idFieldName,
                messageIdFieldType: fieldTypes[type.idFieldName],
                arrayField: fieldName,
                arrayFieldType: fieldTypes[fieldName]
            }))
    ];
}

//   _____                _ 
//  |  __ \              | |
//  | |__) |___  __ _  __| |
//  |  _  // _ \/ _` |/ _` |
//  | | \ \  __/ (_| | (_| |
//  |_|  \_\___|\__,_|\__,_|
//
// Return an array of CRUD instructions that read an instance of the specified
// message `type` from the database. Use the specified `legend` to map
// message fields to table columns.
function instructionsReadMessage({type, legend}) {
    const {
        scalarFieldSources,
        arrayFieldSources
    } = byMultiplicity(legend.fieldSources);

    const fieldTypes = Object.fromEntries(
        type.fields.map(({name, type}) => [name, type]));

    return [
        // Query the message table.
        instructionSelectMessage({type, legend}),

        // Read the resulting row.
        {
            instruction: 'read-row',
            destinations: scalarFieldSources.map(
                ({fieldName}) => ({field: fieldName}))
        },

        // For each array field:
        // - query array table
        // - read results into array field
        ...arrayFieldSources.map(({fieldName, tableName}) => [
            // e.g.
            // select value from boyscout_badges where id = ?;
            instructionSelectArray({
                arrayTableName: tableName,
                arrayType: fieldTypes[fieldName],
                messageIdField: type.idFieldName,
                messageIdFieldType: fieldTypes[type.idFieldName]
            }),

            // e.g.
            // for row in result:
            //     row.scan(&boyscout.badges.push_back())
            {
                instruction: 'read-array',
                destination: {field: fieldName}
        }
        ]).flat()
    ];
}

//   _    _           _       _       
//  | |  | |         | |     | |      
//  | |  | |_ __   __| | __ _| |_ ___ 
//  | |  | | '_ \ / _` |/ _` | __/ _ \
//  | |__| | |_) | (_| | (_| | ||  __/
//   \____/| .__/ \__,_|\__,_|\__\___|
//         | |                        
//         |_|
//
// Return an array of CRUD instructions that update an instance of the specified
// message `type` in the database. Use the specified `legend` to map message
// fields to table columns.
function instructionsUpdateMessage({type, legend}) {
    // "Update" is interesting because it takes field inclusion into account
    // (i.e. when somebody does an update, they can specify some subset of
    // message fields to be updated, rather than all of them).
    const {arrayFieldSources} = byMultiplicity(legend.fieldSources);
    const fieldTypes = Object.fromEntries(
        type.fields.map(({name, type}) => [name, type]));

    return [
        // Update the message table.
        // `instructionUpdateMessage` will return `undefined` if no instruction is
        // needed, so we "filter out" that case here.
        ...[instructionUpdateMessage({type, legend})].filter(op => op),

        // For each array field:
        // - remove old (all) values from array table (only if the array is
        //   included)
        // - insert new values into array table (only if the array is included)
        ...arrayFieldSources.map(({fieldName, tableName}) => [
            // e.g.
            // delete from boyscout_badges where id = ?;
            instructionDeleteArray({
                arrayTableName: tableName,
                messageIdField: type.idFieldName,
                messageIdFieldType: fieldTypes[type.idFieldName],
                conditionField: fieldName
            }),

            // e.g.
            // insert into boyscout_badges values (?, ?), (?, ?) ...
            instructionInsertArray({
                arrayTableName: tableName,
                messageIdField: type.idFieldName,
                messageIdFieldType: fieldTypes[type.idFieldName],
                arrayField: fieldName,
                arrayFieldType: fieldTypes[fieldName]
            })
        ]).flat()
    ];
}

//   _____       _      _       
//  |  __ \     | |    | |      
//  | |  | | ___| | ___| |_ ___ 
//  | |  | |/ _ \ |/ _ \ __/ _ \
//  | |__| |  __/ |  __/ ||  __/
//  |_____/ \___|_|\___|\__\___|
//
// Return an array of CRUD instructions that delete an instance of the specified
// message `type` from the database. Use the specified `legend` to map message
// fields to table columns.
function instructionsDeleteMessage({type, legend}) {
    const {
        scalarFieldSources,
        arrayFieldSources
    } = byMultiplicity(legend.fieldSources);

    const keyColumnName = scalarFieldSources
        .find(({fieldName}) => fieldName === type.idFieldName)
        .columnName;
    const fieldTypes = Object.fromEntries(
        type.fields.map(({name, type}) => [name, type]));
    const idFieldType = fieldTypes[type.idFieldName];

    return [
        // Rows in array tables need to be deleted first, since they have
        // foreign keys referencing the row in the message table.
        ...arrayFieldSources.map(({tableName}) =>
            instructionDeleteArray({
                arrayTableName: tableName,
                messageIdField: type.idFieldName,
                messageIdFieldType: idFieldType
            })),

        // Once we've deleted everything that references the instance's row in
        // the message table, we can delete that row.
        {
            instruction: 'exec',
            sql: sqline(`delete from ${quoteName(legend.tableName)}
                where ${quoteName(keyColumnName)} = ${parameter(idFieldType)};`),
            parameters: [
                {field: type.idFieldName}
            ]
        }
    ];
}

//  __          ___           _   _       _   _           _                    _ _ ___  
//  \ \        / / |         | | ( )     | | | |         | |                  | | |__ \ 
//   \ \  /\  / /| |__   __ _| |_|/ ___  | |_| |__   __ _| |_   ___ _ __   ___| | |  ) |
//    \ \/  \/ / | '_ \ / _` | __| / __| | __| '_ \ / _` | __| / __| '_ \ / _ \ | | / / 
//     \  /\  /  | | | | (_| | |_  \__ \ | |_| | | | (_| | |_  \__ \ |_) |  __/ | ||_|  
//      \/  \/   |_| |_|\__,_|\__| |___/  \__|_| |_|\__,_|\__| |___/ .__/ \___|_|_|(_)  
//                                                                 | |                  
//                                                                 |_|    
//
//    _____ _____  _    _ _____    _   _   _ 
//   / ____|  __ \| |  | |  __ \  | | | | | |
//  | |    | |__) | |  | | |  | | | | | | | |
//  | |    |  _  /| |  | | |  | | | | | | | |
//  | |____| | \ \| |__| | |__| | |_| |_| |_|
//   \_____|_|  \_\\____/|_____/  (_) (_) (_)
//
// Return an object of create-read-update-delete (CRUD) operations for all of
// the specified `types`.
function types2crud(types) {
    // Verify that `types` has the expected shape.
    tisch.compileFunction(({Any, etc}) => ({
        // Each property is the name of the type it describes.
        [Any]: {
            'type': schemas.type, // either a message or an enum
            'legend?': schemas.legend // present if `type` is a message
        },
        ...etc
    })).enforce(types);

    // e.g. if we have two message types "foo" and "bar,"
    //
    //     {
    //         foo: {
    //             create: [...],
    //             read: [...],
    //             ...
    //         },
    //         bar: {
    //             create: [...],
    //             read: [...],
    //             ...
    //         }, 
    //         ...
    //     }
    //
    const result = Object.fromEntries(
        Object.entries(types)
            // CRUD operations are for message types only.
            .filter(([_, {type}]) => type.kind === 'message')
            // Each message type name is mapped to an object of arrays of CRUD
            // instructions.
            .map(([typeName, {type, legend}]) => [
                typeName,
                {
                    create: instructionsCreateMessage({type, legend}),
                    read: instructionsReadMessage({type, legend}),
                    update: instructionsUpdateMessage({type, legend}),
                    delete: instructionsDeleteMessage({type, legend})
                }
            ]));

    // Verify that the result has the expected shape.
    return schemas.crud.enforce(result);
}

return {types2crud};

});
