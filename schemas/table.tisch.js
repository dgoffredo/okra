// Each protobuf message and enum becomes its own SQL table, and each repeated
// (array-valued) message field has its own SQL table (mapping the parent
// object to its values for that field).
//
// This schema describes a JSON table.
//
define(['./builtin.tisch.js'], builtin => ({
    'name': String,
    'description?': String, // e.g. COMMENT section in MySQL
    'columns': [{
        'name': String,
        'protobuf_type': builtin,
        'foreign_key?': {
            'table': String, // name of the foreign table
            'column': String  // name of the column in the foreign table
        },
        'primary_key?': Boolean,
        'description?': String // e.g. COMMENT section in MySQL
    }, ...etc],
    'rows?': [builtin, ...etc]
}))
