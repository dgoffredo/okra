// This module exports a function, `types2crud`, that produces a description
// of create-read-update-delete (CRUD) operations for a given set of types and
// their legends. The SQL statements used in the CRUD operations are
// compatible with MySQL 5.6.

define(['../../schemas/schemas', '../../dependencies/tisch/tisch', './common'],
function (schemas, tisch, common) {
'use strict';

const {quoteName} = common;

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
//
// As of this writing, only the time-related type is treated specially.
function selector({columnName, fieldType}) {
    if (fieldType.builtin === '.google.protobuf.Timestamp') {
        // timestamp(6) → unix timestamp in microseconds
        return `unix_timestamp(${quoteName(columnName)}) * 1000000`;
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
    else {
        return '?';
    }
}

// Return a CRUD operation for adding values into the specified
// `arrayTableName` from the specified `arrayField` of the message type having
// the specified `messageIdField`, where the `messageIdField` has the
// specified `messageIdFieldType` and the elements of the array field have the
// specified `arrayFieldType`. The returned operation will require that
// `arrayField` is included in the operation (if `arrayField` is not included,
// a code generator will not perform the operation).
function operationInsertArray({
    arrayTableName,
    messageIdField,
    messageIdFieldType,
    arrayField,
    arrayFieldType
}) {
    return {
        operation: 'exec-with-tuples',
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

// Return a CRUD operation for selecting rows from the specified
// `arrayTableName` representing an array of the specified `arrayType` in the
// message type having the specified `messageIdField` with the specified
// `messageIdFieldType`.
function operationSelectArray({
    arrayTableName,
    arrayType, // type of the array itself, e.g. `{array: ...}`
    messageIdField,
    messageIdFieldType
}) {
    return {
        operation: 'query',

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

// Return a CRUD operation that deletes all rows from the specified
// `arrayTableName` whose message ID column ("id") of the specified type
// `messageIdFieldType` has the same value as the specified `messageIdField`
// (`messageIdField` is the _name_ of the field whose value we're interested
// in). Optionally specify a `conditionField`, which makes the returned
// operation applicable only if that field is included in the relevant
// operation (e.g. deleting values before replacing them in an "update," but
// only if we're updating that field).
function operationDeleteArray({
    arrayTableName,
    messageIdField,
    messageIdFieldType,
    conditionField
}) {
    return {
        operation: 'exec',
        sql: sqline(`delete from ${quoteName(arrayTableName)}
                where ${quoteName('id')} = ${parameter(messageIdFieldType)};`),
        parameters: [
            {field: messageIdField}
        ],
        // "condition" is optional. Let it appear only if it has a value.
        ...(conditionField ? {condition: {included: conditionField}} : {})
    };
}

// Return a CRUD operation that selects the scalar fields of an instance of
// the specified `type` from the database. Use the specified `legend` to map
// message fields to table columns.
function operationSelectMessage({type, legend}) {
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
        operation: 'query',
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

// Return a CRUD operation that updates the scalar fields of an instance of
// the specified `type` in the database, or return `undefined` if `type` does
// not have any updatable fields. Use the specified `legend` to map message
// fields to table columns.
function operationUpdateMessage({type, legend}) {
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
        operation: 'exec',
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
// Return an array of CRUD operations that add a new instance of the specified
// `type` to the database. Use the specified `legend` to map message fields to
// table columns.
function operationsCreateMessage({type, legend}) {
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
            operation: 'exec',
            sql: sqline(`insert into ${quoteName(legend.tableName)}(
                ${scalarFieldSources.map(({columnName}) => quoteName(columnName)).join(', ')})
                values (${scalarFieldInfos.map(parameter).join(', ')});`),
            parameters: scalarFieldSources.map(({fieldName}) => ({field: fieldName}))
        },

        // For each array field, add rows to the corresponding table.
        ...arrayFieldSources.map(({fieldName, tableName}) =>
            operationInsertArray({
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
// Return an array of CRUD operations that read an instance of the specified
// message `type` from the database. Use the specified `legend` to map
// message fields to table columns.
function operationsReadMessage({type, legend}) {
    const {
        scalarFieldSources,
        arrayFieldSources
    } = byMultiplicity(legend.fieldSources);

    const fieldTypes = Object.fromEntries(
        type.fields.map(({name, type}) => [name, type]));

    return [
        // Query the message table.
        operationSelectMessage({type, legend}),

        // Read the resulting row.
        {
            operation: 'read-row',
            destinations: scalarFieldSources.map(
                ({fieldName}) => ({field: fieldName}))
        },

        // For each array field:
        // - query array table
        // - read results into array field
        ...arrayFieldSources.map(({fieldName, tableName}) => [
            // e.g.
            // select value from boyscout_badges where id = ?;
            operationSelectArray({
                arrayTableName: tableName,
                arrayType: fieldTypes[fieldName],
                messageIdField: type.idFieldName,
                messageIdFieldType: fieldTypes[type.idFieldName]
            }),

            // e.g.
            // for row in result:
            //     row.scan(&boyscout.badges.push_back())
            {
                operation: 'read-array',
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
// Return an array of CRUD operations that update an instance of the specified
// message `type` in the database. Use the specified `legend` to map message
// fields to table columns.
function operationsUpdateMessage({type, legend}) {
    // "Update" is interesting because it takes field inclusion into account
    // (i.e. when somebody does an update, they can specify some subset of
    // message fields to be updated, rather than all of them).
    const {arrayFieldSources} = byMultiplicity(legend.fieldSources);
    const fieldTypes = Object.fromEntries(
        type.fields.map(({name, type}) => [name, type]));

    return [
        // Update the message table.
        // `operationUpdateMessage` will return `undefined` if no operation is
        // needed, so we "filter out" that case here.
        ...[operationUpdateMessage({type, legend})].filter(op => op),

        // For each array field:
        // - remove old (all) values from array table (only if the array is
        //   included)
        // - insert new values into array table (only if the array is included)
        ...arrayFieldSources.map(({fieldName, tableName}) => [
            // e.g.
            // delete from boyscout_badges where id = ?;
            operationDeleteArray({
                arrayTableName: tableName,
                messageIdField: type.idFieldName,
                messageIdFieldType: fieldTypes[type.idFieldName],
                conditionField: fieldName
            }),

            // e.g.
            // insert into boyscout_badges values (?, ?), (?, ?) ...
            operationInsertArray({
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
// Return an array of CRUD operations that delete an instance of the specified
// message `type` from the database. Use the specified `legend` to map message
// fields to table columns.
function operationsDeleteMessage({type, legend}) {
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
            operationDeleteArray({
                arrayTableName: tableName,
                messageIdField: type.idFieldName,
                messageIdFieldType: idFieldType
            })),

        // Once we've deleted everything that references the instance's row in
        // the message table, we can delete that row.
        {
            operation: 'exec',
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
            // operations.
            .map(([typeName, {type, legend}]) => [
                typeName,
                {
                    create: operationsCreateMessage({type, legend}),
                    read: operationsReadMessage({type, legend}),
                    update: operationsUpdateMessage({type, legend}),
                    delete: operationsDeleteMessage({type, legend})
                }
            ]));

    // Verify that the result has the expected shape.
    return schemas.crud.enforce(result);
}

return {types2crud};

});
