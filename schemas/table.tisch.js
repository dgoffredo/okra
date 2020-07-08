// Each protobuf message and enum becomes its own SQL table, and each repeated
// (array-valued) message field has its own SQL table (mapping the parent
// object to its values for that field).
//
// TODO: add a note about the "name" column type
//
// This schema describes a JSON table.
//
define(['./builtin.tisch.js'], builtin => ({
    'name': String,
    'description?': String, // e.g. COMMENT section in MySQL
    'primaryKey?': String, // column name of the primary key
    'columns': [{
        'name': String,
        'type': or(builtin, 'name'), // "name" for enum value names
        'nullable': Boolean,
        'foreignKey?': {
            'table': String, // name of the foreign table
            'column': String  // name of the column in the foreign table
        },
        'description?': String // e.g. COMMENT section in MySQL
    }, ...etc],
    // TODO: no timestamp hard-coded values yet
    'rows?': [[or(Number, String, null), ...etc], ...etc],
    'indices?': [{
        'columns': [String, ...etc] // name of indexed column(s)
    }, ...etc]
}))
