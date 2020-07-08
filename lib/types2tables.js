define(['../schemas/schemas'], function (schemas) {

// Return an array of the "words" in the specified string as determined by
// interpreting the string with various naming conventions, like:
//
// - "snake_case" -> ["snake", "case"]
// - "camelCase" -> ["camel", "Case"]
// - "camelCaseWithCAPS" -> ["camel", "Case", "With", "CAPS"]
// - "CAPSFollowedByCamelCase" -> ["CAPS", "Followed", "By", "Camel", "Case"]
// - "SHOUTING_CASE" -> ["SHOUTING", "CASE"]
// - "names with spaces" -> ["names", "with", "spaces"]
// - "hyphen-case" -> ["hyphen", "case"]
// - "other;kinds::of--punctuation" -> ["other", "kinds", "of", "punctuation"]
// - "ANYCrazy_COMBINATION::of . styles" ->
//       ["ANY", "Crazy", "COMBINATION", "of", "styles"]
//
// The resulting array of strings contains the words with their original casing.
// Connecting characters, such as punctuation and whitespace, are omitted.
const splitName = (function() {
    // These patterns will be or'd together to make the full pattern.
    // Don't forget the "u" flag for "unicode" and the "g" flag for "global."
    const separators = [
        /(\s|\p{P})+/, // whitespace or punctuation
        /(?<=\p{Lu})(?=\p{Lu}\p{Ll})/, // THISCase (match has length zero)
        /(?<=\p{Ll})(?=\p{Lu})/ // thisCase (match has length zero)
    ];
    const pattern = separators.map(regex => regex.source).join('|');
    const separatorRegex = RegExp(pattern, 'gu');

    return function (text) {
        return text.split(separatorRegex).filter(part =>
            // Splitting on a zero-length separator (like the "virtual
            // character" between "O" and "B" in "FOOBar") yields `undefined`.
            // Splitting on whitespace/punctuation yields the matching
            // whitespace/punctutation. Omit both cases.
            part !== undefined && !part.match(separatorRegex));
    };
}());

// Return an object `{tables: {...}, legends: {...}}` of table definitions and
// legends deduced from the specified array of `types` (where each element of
// `types` satisfies `schemas/type.tisch.js`). Use the optionally specified
// `options` object to customize the returned tables.
//
// The `tables` property of the returned value is an object whose keys are the
// names of database tables, and whose values are objects that satify
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

// Return the name of the table for values of the specified array-valued field
// having the specified `fieldName` in the protobuf message having the
// specified `messageName`. Separate words in the output using the convention
// indicated by the specified `namingStyle` (e.g. "snake_case").
function arrayTableName(messageName, fieldName, namingStyle) {
    // The "chickens" array field of the "farm" message type will be a table
    // named "farm_chickens", or maybe "FarmChickens", depending on
    // `namingStyle`.

    // Since `normalizeName` will split the name apart in various ways, we can
    // connect the two parts of the input name together using any whitespace or
    // punctuation.
    return normalizeName(`${messageName}_${fieldName}`, namingStyle);
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

            if (field.type.array) {
                source.tableName = arrayTableName(type.name, field.name, namingStyle);
                source.columnName = 'value';
            }
            else {
                source.columnName = fieldName2ColumnName(field.name, namingStyle);
            }

            return source;
        })
    });
}

// Return a table object (satisfying the schema `table.tisch.js`) that holds
// instances of the specified message `type`. Use the specified `namingStyle`
// for SQL table and column names. Note that other tables associated with the
// type, such as those containing the values of its array-valued fields, are
// not calculated by this function (see `message2arrayTables`).
function message2table(type, namingStyle) {
    return schemas.table.enforce(withDocs(type, {
        name: typeName2tableName(type.name, namingStyle),
        primaryKey: fieldName2ColumnName(type.idFieldName),
        // Each non-array field is a column in the table. The array-valued
        // fields are separate tables (dealt with later).
        columns: type.fields.filter(field => !field.type.array).map(field => {
            const column = withDocs(field, {
                name: fieldName2ColumnName(field.name),
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
            else {
                // The only remaining possibility is `.builtin`.
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
//     insert into painting_colors(id, value)
//     values (1337, 'red'), (1337, 'green'), (1337, 'blue');
//
function message2arrayTables(type, namingStyle) {
    // these have to be consistent with `message2table`
    const messageTableName = typeName2tableName(type.name, namingStyle);
    const messagePrimaryKey = fieldName2ColumnName(type.idFieldName);

    // The first column of each array table will have a foreign key to the ID
    // of `type`. Those columns have to have the same type.
    const messageIdColumnType =
        type.field.find(field => field.name === type.idFieldName).type.builtin;

    return type.fields.filter(field => field.type.array).map(field => {
        const arrayTable = withDocs(field, {
            name: arrayTableName(type.name, field.name, namingStyle),
            indices: [{columns: ['id']}], // index the message (e.g. painting) ID
            // The array table has two columns. Here's the first. The second
            // depends on the underlying type of the array, so that's
            // calculated separately.
            columns: [{
                    name: 'id',
                    type: messageIdFieldType,
                    nullable: false,
                    foreignKey: {
                        table: messageTableName,
                        column: messagePrimaryKey
                    },
                    // redundant, but possibly helpful
                    description: `${type.idFieldName} of the relevant ${type.name}`
            }]
        });

        // The second column depends on whether the array contains enums. If
        // it contains enums then the values cannot be null, and have a foreign
        // key to the relevant enum table. If they don't contain enums, then
        // they can be null and just have whatever value they have.
        if (field.type.array.enum) {
            arrayTable.columns.push({
                name: 'value',
                type: 'TYPE_INT32',
                nullable: false,
                foreignKey: {
                    table: typeName2TableName(field.type.array.enum, namingStyle),
                    column: 'id'
                },
                // redundant, but possibly helpful
                description: `one of the ${field.name} in some ${type.name}`
            });
        }
        else {
            arrayTable.columns.push({
                name: 'value',
                type: field.type.array.builtin,
                nullable: true,
                // redundant, but possibly helpful
                description: `one of the ${field.name} in some ${type.name}`
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
        primaryKey: 'id',
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
    return normalizeName(fieldName, namingStyle);
}

function normalizeName(name, namingStyle) {
    const words = splitName(name);

    if (namingStyle === 'snake_case') {
        return words.map(word => word.toLowerCase()).join('_');
    }

    throw Error(`unexpected naming style ${JSON.stringify(namingStyle)}`);
}

return {types2tables};

});
