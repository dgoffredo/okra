define(['../schemas/schemas', './names'], function (schemas, names) {
'use strict';

// Return an object `{tables: {...}, legends: {...}}` of table definitions and
// legends deduced from the specified array of `types` (where each element of
// `types` satisfies `schemas/type.tisch.js`). Use the optionally specified
// `options` object to customize the returned tables.
//
// The `tables` property of the returned value is an object whose keys are the
// names of database tables, and whose values are objects that satisfy
// `schemas/table.tisch.js`.
//
// The `legends` property of the returned value is an object whose keys are the
// names of message types, and whose values are objects that satisfy
// `schemas/legend.tisch.js`.
//
// See the implementation for supported `options`.
function types2tables(types, options = {}) {
    types.forEach(schemas.type.enforce);

    options.namingStyle = options.namingStyle || 'snake_case';

    const tables = {};
    const legends = {};

    types.forEach(type => {
        if (type.kind === 'enum') {
            const table = enum2table(type, options);
            tables[table.name] = table;
        }
        else if (type.kind === 'message') {
            const {legend, table, arrayTables} = message2tables(type, options);
            [table, ...arrayTables].forEach(table => tables[table.name] = table);
            legends[type.name] = legend;
        }
        else {
            throw Error(`Unexpected type kind ${JSON.stringify(type.kind)}`);
        }
    });

    return {tables, legends};
}

// Return the column type corresponding to the specified `fieldType` for a column that is
// also a primary key.
// The reason that primary key columns are typed specially is that
// `TYPE_STRING` maps to some "large" variable length text type in most
// databases, while in some (all?) databases primary key column must be of
// fixed size.
function primaryKeyColumnType(fieldType) {
    if (fieldType.enum) {
        // as in the non-primary-key case, enum columns are int32
        return 'TYPE_INT32';
    }
    else if (fieldType.builtin == 'TYPE_STRING') {
        return 'name'; // not-too-long text (also used for enum names)
    }
    else {
        return fieldType.builtin;
    }
}

// Return the name of the table for values of the specified array-valued field
// having the specified `fieldName` in the protobuf message having the
// specified `messageName`. Separate words in the output using the convention
// indicated by the specified `namingStyle` (e.g. "snake_case").
function arrayTableName(messageName, fieldName, namingStyle) {
    // The "chickens" array field of the "farm" message type will be a table
    // named "farm_chickens", or maybe "FarmChickens", depending on
    // `namingStyle`.

    // Since `typeName2tableName` will split the name apart in various ways, we can
    // connect the two parts of the input name together using any whitespace or
    // punctuation except a period. Here I use a space.
    return typeName2tableName(`${messageName} ${fieldName}`, namingStyle);
}

// Return a legend object (satisfying the schema `legend.tisch.js`) that
// describes the correspondence between the specified message `type` and any
// SQL tables generated from it, such as the table of values of that type, and
// tables of values for array (repeated) fields in the type. Use the specified
// `namingStyle` for SQL table and column names.
function message2legend(type, namingStyle) {
    return schemas.legend.enforce({
        messageTypeName: type.name,
        // this has to be consistent with `message2table`
        tableName: typeName2tableName(type.name, namingStyle),
        fieldSources: type.fields.map(field => {
            const source = {
                fieldName: field.name
            };

            if (isArrayLike(field.type)) {
                source.tableName = arrayTableName(type.name, field.name, namingStyle);
                // the column name is always "value"
            }
            else {
                source.columnName = fieldName2columnName(field.name, namingStyle);
            }

            return source;
        })
    });
}

// A message has a one-to-many relationship with each of its array-typed fields
// (repeated fields), but also with the special builtin "FieldMask". This
// function accounts for both cases.
function isArrayLike(type) {
    return type.array || type.builtin === '.google.protobuf.FieldMask';
}

// Return a table object (satisfying the schema `table.tisch.js`) that holds
// instances of the specified message `type`. Use the specified `namingStyle`
// for SQL table and column names. Note that other tables associated with the
// type, such as those containing the values of its array-valued fields, are
// not calculated by this function (see `message2arrayTables`).
function message2table(type, namingStyle) {
    const primaryKeyColumnName =
        fieldName2columnName(type.idFieldName, namingStyle);

    return schemas.table.enforce(withDocs(type, {
        name: typeName2tableName(type.name, namingStyle),
        primaryKey: [primaryKeyColumnName],
        // Each non-array field is a column in the table. The array-valued
        // fields are separate tables (dealt with later -- see
        // `message2arrayTables`).
        columns: type.fields.filter(field => !isArrayLike(field.type)).map(field => {
            const column = withDocs(field, {
                name: fieldName2columnName(field.name, namingStyle),
                nullable: field.name !== type.idFieldName
                // `.type` and possibly `.foreignKey` are filled out below.
            });

            if (field.type.enum) {
                // Scalar (non-array) enum columns are int32 with a foreign
                // key to the table of meanings for that enum.
                column.type = 'TYPE_INT32';
                column.foreignKey = {
                    table: typeName2tableName(field.type.enum, namingStyle),
                    column: 'id' // enum tables are all keyed on an "id" column
                };
            }
            // primary key column type is sometimes special
            else if (column.name === primaryKeyColumnName) {
                column.type = primaryKeyColumnType(field.type);
            }
            // otherwise it has to be builtin
            else {
                column.type = field.type.builtin;
            }

            return column;
        })
    }));
}

// Each array-valued field in a message has its own table of (id, value) pairs,
// e.g.
//
//     painting.id = 1337
//     painting.colors = ["red", "green", "blue"]
//
// yields
//
//     insert into painting_colors(id, ordinality, value)
//     values (1337, 0, 'red'), (1337, 1, 'green'), (1337, 2, 'blue');
//
function message2arrayTables(type, namingStyle) {
    // these have to be consistent with `message2table`
    const messageTableName = typeName2tableName(type.name, namingStyle);
    const messagePrimaryKey = fieldName2columnName(type.idFieldName, namingStyle);

    // The first column of each array table will have a foreign key to the ID
    // of `type`. Those columns have to have the same type.
    const messageIdColumnType = primaryKeyColumnType(
        type.fields.find(field => field.name === type.idFieldName).type);

    return type.fields.filter(field => isArrayLike(field.type)).map(field => {
        const arrayTable = withDocs(field, {
            name: arrayTableName(type.name, field.name, namingStyle),

            // The primary key is the ID of the related message table, and
            // then the "ordinality" (array position, i.e. index, offset) of
            // the value.
            primaryKey: ['id', 'ordinality'],

            // The array table has three columns. Here are the first two. The
            // third depends on the underlying type of the array, so that's
            // calculated separately.
            columns: [
                {
                    name: 'id',
                    type: messageIdColumnType,
                    nullable: false,
                    foreignKey: {
                        table: messageTableName,
                        column: messagePrimaryKey
                    },
                    // redundant, but possibly helpful
                    description: `${type.idFieldName} of the relevant ${type.name}`
                },
                {
                    name: 'ordinality',
                    // Do you really need more than four billion elements?
                    type: 'TYPE_UINT32',
                    nullable: false,
                    description: 'zero-based position within the array'
                }
            ]
        });

        // The second column depends on whether the array contains enums. If it
        // contains enums then the values have a foreign key to the relevant
        // enum table. If they don't contain enums, then they just have
        // whatever value they have.
        // Also, the field might not be an array, it might be a FieldMask. In
        // that case, treat it as if it were an array of name strings.
        if (field.type.array && field.type.array.enum) {
            arrayTable.columns.push({
                name: 'value',
                type: 'TYPE_INT32',
                nullable: true,
                foreignKey: {
                    table: typeName2tableName(field.type.array.enum, namingStyle),
                    column: 'id'
                },
                // redundant, but possibly helpful
                description: `one of the ${field.name} in some ${type.name}`
            });
        }
        else if (field.type.array) {
            arrayTable.columns.push({
                name: 'value',
                type: field.type.array.builtin,
                nullable: true,
                // redundant, but possibly helpful
                description: `one of the ${field.name} in some ${type.name}`
            });
        }
        else {
            // field.type.builtin === ".google.protobuf.FieldMask"
            arrayTable.columns.push({
                name: 'value',
                type: 'name',
                nullable: true,
                // redundant, but possibly helpful
                description: `one of the fields named by ${field.name} in some ${type.name}`
            });
        }

        return schemas.table.enforce(arrayTable);
    });
}

// Return a description of all SQL tables needed to store instances of the
// specified `type`, together with a legend that correlates the fields of the
// type with the columns of the tables. Customize the returned tables
// according to the specified `options` object. See the comments in the
// implementation for more information.
function message2tables(type, options) {
    // `namingStyle` determines whether tables and columns will be
    // named_like_this, or namedLikeThis, or `named like this`, etc. As of this
    // writing, only "snake_case" is accepted, rendering SQL names_like_this.
    const {namingStyle} = options;

    return {
        // the table whose rows are instances of the type.
        // satisfies the `table.tisch.js` schema.
        table: message2table(type, namingStyle),

        // tables that contain values for array-valued fields (one table for
        // each such field).
        // an array whose elements each satisfy the `table.tisch.js` schema.
        arrayTables: message2arrayTables(type, namingStyle),

        // an object that correlates the type and its fields with the generated
        // tables and their columns.
        // satisfies the `legend.tisch.js` schema.
        legend: message2legend(type, namingStyle)
    };
}

// Return a table that describes the specified enum `type` and its values.
// Customize the returned table according to the specified `options` object.
function enum2table(type, options) {
    const {namingStyle} = options;

    return schemas.table.enforce(withDocs(type, {
        name: typeName2tableName(type.name, namingStyle),
        primaryKey: ['id'],
        columns: [
            {name: 'id', type: 'TYPE_INT32', nullable: false},
            {name: 'name', type: 'name', nullable: false},
            {name: 'description', type: 'TYPE_STRING', nullable: true}
        ],
        rows: type.values.map(enumValue => [
            enumValue.id,
            enumValue.name, // keep name verbatim from input
            'description' in enumValue ? enumValue.description : null
        ])
    }));
}

// Include in the specified `destinationObject` documentation from the
// specified `sourceObject`, if any. Return `destinationObject`.
function withDocs(sourceObject, destinationObject) {
    if ('description' in sourceObject) {
        destinationObject.description = sourceObject.description;
    }

    return destinationObject;
}

function typeName2tableName(typeName, namingStyle) {
    const nameStem = typeName.split('.').pop();
    // Reuse the function for converting field names to column names (we'll
    // use the same conventions for table names).
    return fieldName2columnName(nameStem, namingStyle);
}

function fieldName2columnName(fieldName, namingStyle) {
    return names.normalize(fieldName, namingStyle);
}

return {types2tables};

});
