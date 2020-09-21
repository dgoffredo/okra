// one message type with a field that's a FieldMask
[{
    kind: 'message',
    name: '.stonks.Mirror',
    description: 'up up up up',
    idFieldName: 'stonk',
    fields: [
        {id: 1, name: 'stonk', type: {builtin: 'TYPE_STRING'}},
        {id: 2, name: 'stuff', type: {builtin: '.google.protobuf.FieldMask'}}
    ]
}]
