({
    tables: {
        // just the one table, generated from the .fair.Hotdog enum type
        'hotdog': {
            name: 'hotdog',
            description: 'the original grilling sensation',
            primaryKey: 'id',
            columns: [
                {name: 'id', type: 'TYPE_INT32', nullable: false},
                {name: 'name', type: 'name', nullable: false},
                {name: 'description', type: String, nullable: true}
            ],
            rows: [
                [0, 'UNSET', null],
                [1, 'KOSHER_BEEF', null],
                [2, 'TURKEY', null],
                [3, 'FAUX_MEAT', null],
                [4, 'CARROT', 'for the vegans']
            ]
        }
    },
    legends: {} // none, since we don't have any message types
})
