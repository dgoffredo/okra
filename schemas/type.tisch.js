define(['builtin.tisch.js'], builtin => 
    // Note that all non-builtin type names (i.e. the names of enums and
    // messages) are fully qualified with their protobuf namespaces, including
    // the initial "." denoting the toplevel namespace.
    or(
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