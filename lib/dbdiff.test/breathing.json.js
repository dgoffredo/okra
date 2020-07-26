// This is a test that I used when writing `dbdiff.js`
({
    tablesBefore: {
        foo: {
            name: 'foo',
            description: "here's the old description",
            primaryKey: 'id',
            columns: [
                {name: 'id', type: 'TYPE_INT32', nullable: false},
                {name: 'fooness', type: 'TYPE_FLOAT', nullable: false,
                description: 'maximum fooness!'}
            ],
            rows: [
                [1, 1.0 / 1],
                [2, 1.0 / 2],
                [3, 1.0 / 3]
            ]
        },
        // This table isn't in "tablesAfter," but since there's not table
        // dropping in okra, it's just ignored by the diff function.
        baz: {
            name: 'baz',
            columns: []
        }
    },

    tablesAfter: {
        foo: {
            name: 'foo',
            description: "here's the new description", // changed
            primaryKey: 'id',
            columns: [
                {name: 'id', type: 'TYPE_INT32', nullable: false},
                {name: 'fooness', type: 'TYPE_DOUBLE', nullable: false,
                 description: 'maximum fooness!'},
                {name: 'annex', type: 'TYPE_STRING', nullable: true} // added
            ],
            rows: [
                [1, 1 / 1],
                [2, 1 / 1337], // updated
                [3, 1 / 3]
            ]
        },
        chicken: { // added
            name: 'chicken',
            columns: []
        }
    }
})
