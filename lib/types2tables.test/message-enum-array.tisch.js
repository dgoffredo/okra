({
    tables: {
        'shoe_brand': {
            name: 'shoe_brand',
            primaryKey: 'id',
            columns: [
                {name: 'id', type: 'TYPE_INT32', nullable: false},
                {name: 'name', type: 'name', nullable: false},
                {name: 'description', type: 'TYPE_STRING', nullable: true}
            ],
            rows: [
                [0, 'UNKNOWN', null],
                [1, 'Nike', null],
                [2, 'Adidas', null],
                [3, 'Other', null]
            ]
        },
        'shoe_store': {
            name: 'shoe_store',
            primaryKey: 'id',
            columns: [
                {name: 'id', nullable: false, type: 'TYPE_UINT64'},
                {name: 'name_english', nullable: true, type: 'TYPE_STRING'}
            ]
        },
        'shoe_store_brands': {
            name: 'shoe_store_brands',
            indices: [{
                columns: [
                    'id'
                ]
            }],
            columns: [
                {name: 'id', type: 'TYPE_UINT64', nullable: false,
                 foreignKey: {
                    table: 'shoe_store',
                    column: 'id'
                 },
                 description: 'id of the relevant .clothing.ShoeStore'},
                {name: 'value', type: 'TYPE_INT32', nullable: false,
                 // This is the interesting part. Since the array field
                 // (.clothing.ShoeStore.brands) is an enum
                 // (.clothing.ShoeStore.ShoeBrand), the "value" column in the
                 // array table has a foreign key to the enum table.
                 foreignKey: {
                     table: 'shoe_brand',
                     column: 'id'
                 },
                 description: 'one of the brands in some .clothing.ShoeStore'}
            ]
        }
    },
    legends: {
        '.clothing.ShoeStore': {
            messageTypeName: '.clothing.ShoeStore',
            tableName: 'shoe_store',
            fieldSources: [
                {fieldName: 'id', columnName: 'id'},
                {fieldName: 'nameEnglish', columnName: 'name_english'},
                {fieldName: 'brands',
                 tableName: 'shoe_store_brands',
                 columnName: 'value'}
            ]
        }
    }
})
