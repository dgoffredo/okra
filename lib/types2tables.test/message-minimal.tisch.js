({
    tables: {
        'body_mass_index': {
            name: 'body_mass_index',
            primaryKey: 'user_id',
            columns: [
                {name: 'user_id', type: 'TYPE_UINT64', nullable: false},
                {name: 'height_decimillimeters', type: 'TYPE_UINT32', nullable: true},
                {name: 'weight_grams', type: 'TYPE_UINT32', nullable: true}
            ]
        }
    },
    legends: {
        '.medical.BodyMassIndex': {
            messageTypeName: '.medical.BodyMassIndex',
            tableName: 'body_mass_index',
            fieldSources: [
                {fieldName: 'userID', columnName: 'user_id'},
                {fieldName: 'heightDecimillimeters', columnName: 'height_decimillimeters'},
                {fieldName: 'weightGrams', columnName: 'weight_grams'}
            ]
        }
    }
})

