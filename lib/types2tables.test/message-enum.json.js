// a message type that has a non-array (non-repeated) enum field.
// Thus we have two types: the enum, and the message that has an enum.
[
    {
        kind: 'enum',
        name: '.clothing.ShoeStyle',
        description: 'Fads come and go, but style is timeless.',
        values: [
            {id: 0, name: 'UNKNOWN'},
            {id: 1, name: 'VELCRO', description: 'the future'},
            {id: 2, name: 'LACED'},
            // looks like ID 3 was deprecated
            {id: 4, name: 'LOAFER'},
            {id: 5, name: 'SLIP_ON'},
            {id: 6, name: 'SANDAL'}
        ]
    },

    {
        kind: 'message',
        name: '.clothing.Shoe',
        description: 'the thing you put on your foot',
        idFieldName: 'id',
        fields: [
            {id: 1, name: 'id', type: {builtin: 'TYPE_STRING'},
             description: 'Amazon Standard Identification Number (ASIN) in standard form'},
            {id: 2, name: 'sizeAmericanTimesFour', type: {builtin: 'TYPE_UINT32'},
             description: 'x4 so that all half and quarter sizes yield integers'},
            {id: 3, name: 'style', type: {enum: '.clothing.ShoeStyle'}}
        ]
    }
]
