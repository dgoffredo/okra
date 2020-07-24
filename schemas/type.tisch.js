define(['builtin.tisch.js'], builtin => 
    // Note that all non-builtin type names (i.e. the names of enums and
    // messages) are fully qualified with their protobuf namespaces, including
    // the initial "." denoting the toplevel namespace.
    or(
        // A user-defined enumeration, i.e. a protobuf `enum`.
        {
            'kind': 'enum',
            'file?': String, // path to .proto file where this enum is defined
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
            'file?': String, // path to .proto file where this message is defined
            'name': String,
            'description?': String,
            // name of the field that identifies this object (e.g. "id")
            'idFieldName': String,
            'fields': [{
                // Protobuf message fields have integer IDs. I think that
                // they're mostly for efficient encoding (minimal field tags).
                // I have no use for them, but I keep them here because why
                // not. Maybe some CRUD backend will make use of the IDs.
                'id': Number,
                'name': String,
                'type': or(
                    {'builtin': builtin},
                    {'enum': String},
                    {'array': {'builtin': builtin}},
                    {'array': {'enum': String}}),
                'description?': String
            }, ...etc]
        }));