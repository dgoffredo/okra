// Each protobuf message and enum becomes its own SQL table, and each repeated
// (array-valued) message field has its own SQL table (mapping the parent
// object to its values for that field).
//
// This schema describes a JSON table.
//
({
    'name': String,
    'description?': String, // e.g. COMMENT section in MySQL
    'columns': [{
        'name': String,
        // `protobuf_type` values are either a subset of the names of the enum values
        // in `enum FieldDescriptorProto.Type` in
        // `google/protobuf/descriptor.proto`, or the fully qualified protobuf
        // type name of one of Google's "well-known types" (e.g.
        // ".google.protobuf.Timestamp").
        // A few things to note:
        // - The types "TYPE_MESSAGE" and "TYPE_ENUM" are omitted. Messages
        //   aren't applicable, and enums are instead represented using
        //   "TYPE_INT32".
        // - All of the "FIXED" integer types are omitted. Their non-fixed
        //   equivalents are used instead (e.g. instead of "TYPE_FIXED64", use
        //   "TYPE_UINT64").
        // - The explicitly signed (i.e. with an "S") integer types are
        //   omitted. Their plain equivalents are used instead (e.g. instead of
        //   "TYPE_SINT64", use "TYPE_INT64").
        'protobuf_type': or(
            'TYPE_DOUBLE',
            'TYPE_FLOAT',
            'TYPE_INT64',
            'TYPE_UINT64',
            'TYPE_INT32',
            'TYPE_UINT32',
            'TYPE_BOOL',
            'TYPE_STRING',
            'TYPE_BYTES',
            '.google.protobuf.Timestamp'),
        'foreign_key?': {
            'table': String, // name of the foreign table
            'column': String  // name of the column in the foreign table
        },
        'primary_key?': Boolean,
        'description?': String // e.g. COMMENT section in MySQL
    }, ...etc]
})