define(['builtin.tisch.js'], builtin => 
    or(
        // TODO: doc
        {
            'kind': 'builtin',
            'name': builtin
        },
    
        // TODO: doc
        {
            'kind': 'enum',
            'name': String,
            'description?': String,
            'values': [{
                'id': Number,
                'name': String,
                'description?': String
            }, ...etc]
        },
    
        // TODO: doc
        {
            'kind': 'message',
            'name': String,
            'description?': String,
            'fields': [{
                'id': Number,
                'name': String,
                'is_array': Boolean, // TODO is_array versus type: {array: ...}
                'type': (scalar => or(scalar, {"array": scalar}))(
                    or({'builtin': builtin},
                        {'enum': String})),
                'description?': String
            }, ...etc]
        }));