// `builtin` values are either a subset of the names of the enum values in
// `enum FieldDescriptorProto.Type` in `google/protobuf/descriptor.proto`, or
// the fully qualified protobuf type name of one of Google's "well-known
// types" (e.g. ".google.protobuf.Timestamp").
//
// A few things to note:
//
// - The types "TYPE_MESSAGE" and "TYPE_ENUM" are omitted. Messages
//   aren't applicable (they're not in any sense "built in"), and enums are
//   instead represented using "TYPE_INT32".
// - All of the "FIXED" integer types are omitted. Their non-fixed
//   equivalents are used instead (e.g. instead of "TYPE_FIXED64", use
//   "TYPE_UINT64").
// - The explicitly signed (i.e. with an "S") integer types are
//   omitted. Their plain equivalents are used instead (e.g. instead of
//   "TYPE_SINT64", use "TYPE_INT64").
//
or('TYPE_DOUBLE',
   'TYPE_FLOAT',
   'TYPE_INT64',
   'TYPE_UINT64',
   'TYPE_INT32',
   'TYPE_UINT32',
   'TYPE_BOOL',
   'TYPE_STRING',
   'TYPE_BYTES',
   '.google.protobuf.Timestamp')
