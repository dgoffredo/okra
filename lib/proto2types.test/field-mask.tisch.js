// This schema describes the expected output of `field-mask.proto`.
[{
    kind: 'message',
    file: 'field-mask.proto',
    name: '.sassafras.sassafras.UpdateItem',
    description: String,
    idFieldName: 'id',
    fields: [{
        id: 1,
        name: 'id',
        type: {builtin: 'TYPE_UINT64'}
    }, {
        id: 2,
        name: 'stuff',
        type: {builtin: '.google.protobuf.FieldMask'}
    }]
}]
