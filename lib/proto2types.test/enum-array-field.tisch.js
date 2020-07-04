[{
    kind: 'message',
    name: '.foobar.Grill',
    idFieldName: 'id',
    fields: [{
        id: 1,
        name: 'id',
        type: {builtin: 'TYPE_INT64'}
    }, {
        id: 2,
        name: 'hotdog',
        type: {array: {enum: '.foobar.Hotdog'}}
    }]
}, {
    kind: 'enum',
    name: '.foobar.Hotdog',
    values: [{
        id: 0,
        name: 'UNSET'
    }, {
        id: 1,
        name: 'BEEF',
    }, {
        id: 3,
        name: 'TURKEY',
    }]
}]
