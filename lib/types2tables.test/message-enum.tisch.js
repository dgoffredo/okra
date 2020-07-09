({
    tables: {
        'shoe_style': {
            name: 'shoe_style',
            primaryKey: 'id',
            columns: [
                {name: 'id', type: 'TYPE_INT32', nullable: false},
                {name: 'name', type: 'name', nullable: false},
                {name: 'description', type: 'TYPE_STRING', nullable: true}
            ],
            rows: [
                [0, 'UNKNOWN', null],
                [1, 'VELCRO', 'the future'],
                [2, 'LACED', null],
                [4, 'LOAFER', null],
                [5, 'SLIP_ON', null],
                [6, 'SANDAL', null]
            ],
            description: 'Fads come and go, but style is timeless.'
        },
        'shoe': {
            name: 'shoe',
            primaryKey: 'id',
            columns: [
                {name: 'id',
                 nullable: false,
                 description: 'Amazon Standard Identification Number (ASIN) in standard form',
                 type: 'TYPE_STRING'},
                {name: 'size_american_times_four',
                  nullable: true,
                  description: 'x4 so that all half and quarter sizes yield integers',
                  type: 'TYPE_UINT32'},
                {name: 'style',
                  nullable: true,
                  type: 'TYPE_INT32',
                  foreignKey: {
                      table: 'shoe_style',
                      column: 'id'
                    }
                }
            ],
            description: 'the thing you put on your foot'
        }
    },
    legends: {
        '.clothing.Shoe': {
            messageTypeName: '.clothing.Shoe',
            tableName: 'shoe',
            fieldSources: [
                {fieldName: 'id', columnName: 'id'},
                {fieldName: 'sizeAmericanTimesFour',
                 columnName: 'size_american_times_four'},
                {fieldName: 'style', columnName: 'style'}
            ]
        }
    }
})
