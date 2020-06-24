// Each protobuf message and enum becomes its own SQL table, and each repeated
// (array-valued) message field has its own SQL table (mapping the parent
// object to its values in that field). This schema describes the JSON
// representation of a JSON table.
({
    'name': String,
    'columns': [{
        'name': String,
        'protobuf_type': String,
        'foreign_key?': {
            'table': String,
            'column': String
        },
        'primary_key?': Boolean
    }, ...etc]
})