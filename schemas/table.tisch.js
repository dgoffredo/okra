// Each protobuf message and enum becomes its own SQL table, and each repeated
// (array-valued) message field has its own SQL table (mapping the parent
// object to its values for that field).
//
// This schema describes a JSON table.
//
define(['./builtin.tisch.js'], builtin => ({
    'name': String,
    'description?': String, // e.g. COMMENT section in MySQL
    'primaryKey?': String, // column name of the primary key
    'columns': [{
        'name': String,
        // Column types are one of the builtins, or a special type used only
        // in the implementation: "name". "name" is the type of an enum value
        // name. Strings likely map to a column type with a large storage
        // capacity. This is unnecessary for the name of an enum value, which
        // is likely fewer than a few hundred characters. Thus, "name" is an
        // additional type, separate from what can be expressed in a proto
        // file.
        'type': or(builtin, 'name'),
        'nullable': Boolean,
        'foreignKey?': {
            'table': String, // name of the foreign table
            'column': String  // name of the column in the foreign table
        },
        'description?': String // e.g. COMMENT section in MySQL
    }, ...etc],
    'rows?': [[or(Number, String, null), ...etc], ...etc],
    'indices?': [{
        'columns': [String, ...etc] // name of indexed column(s)
    }, ...etc]
}))
