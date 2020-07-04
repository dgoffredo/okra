// Each protobuf message and enum becomes its own SQL table, and each repeated
// (array-valued) message field has its own SQL table (mapping the parent
// object to its values for that field).
//
// This schema describes a JSON table.
//
define(['./builtin.tisch.js'], builtin => ({
    'name': String,
    'description?': String, // e.g. COMMENT section in MySQL
    'primaryKey': String, // column name of the primary key
    'columns': [{
        'name': String,
        'protobufType': builtin,
        'foreignKey?': {
            'table': String, // name of the foreign table
            'column': String  // name of the column in the foreign table
        },
        'description?': String // e.g. COMMENT section in MySQL
    }, ...etc],
    'rows?': [builtin, ...etc]
}))
