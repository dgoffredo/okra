// a message type that has an array (repeated) enum field.
// As in the non-array enum case, we have two types: the enum, and the message
// that has the enum.
[
    {
        kind: 'enum',
        name: '.clothing.ShoeBrand',
        values: [
            {id: 0, name: 'UNKNOWN'},
            {id: 1, name: 'Nike'},
            {id: 2, name: 'Adidas'},
            {id: 3, name: 'Other'}
        ]
    },

    {
        kind: 'message',
        name: '.clothing.ShoeStore',
        idFieldName: 'id',
        fields: [
            {id: 1, name: 'id', type: {builtin: 'TYPE_UINT64'}},
            {id: 2, name: 'nameEnglish', type: {builtin: 'TYPE_STRING'}},
            {id: 3, name: 'brands', type: {array: {enum: '.clothing.ShoeBrand'}}}
        ]
    }
]
