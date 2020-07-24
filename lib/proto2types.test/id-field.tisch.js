// This schema describes the expected output of `id-field.proto`.
[{
    kind: 'message',
    file: 'id-field.proto',
    name: '.sassafras.sassafras.Hello',
    description: String,
    idFieldName: 'id',
    fields: [{
        id: 2,
        name: 'name',
        type: {builtin: 'TYPE_STRING'}
    }, {
        id: 4,
        name: 'snake_case',
        type: {builtin: 'TYPE_UINT64'}
    }, {
        id: 5,
        name: 'camelCase',
        type: {builtin: 'TYPE_UINT64'}
    }, {
        id: 6,
        name: 'id',
        type: {builtin: 'TYPE_INT32'},
        description: String
    }, {
        id: 7,
        name: 'SHOUTING_CASE',
        type: {builtin: 'TYPE_UINT64'},
    }, {
        id: 8,
        name: 'PascalCase',
        type: {builtin: 'TYPE_UINT64'},
    }]
}]
