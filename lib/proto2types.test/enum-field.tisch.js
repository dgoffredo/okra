[{
    kind: 'message',
    name: '.foobar.Menu',
    idFieldName: 'id',
    fields: [{
        id: 1,
        name: 'id',
        type: {builtin: 'TYPE_INT64'}
    }, {
        id: 2,
        name: 'hotdog',
        type: {enum: '.foobar.Hotdog'}
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