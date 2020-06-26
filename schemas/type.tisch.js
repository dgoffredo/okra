define(['builtin.tisch.js'], builtin => 
    or(
        // A "scalar" (basic, builtin, fundamental, atomic) type, e.g. an
        // integer or a string.
        {
            'kind': 'builtin',
            'name': builtin
        },
    
        // A user-defined enumeration, i.e. a protobuf `enum`.
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
    
        // A user-defined aggregate type, i.e. a protobuf `message`.
        {
            'kind': 'message',
            'name': String,
            'description?': String,
            'fields': [{
                'id': Number,
                'name': String,
                'type': (scalar => or(scalar, {'array': scalar}))(
                    or({'builtin': builtin},
                        {'enum': String})),
                'description?': String
            }, ...etc]
        }));