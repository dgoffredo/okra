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
   // Keep these "well-known" built-ins up to date with
   // `function builtinMessage`, defined in `proto2types.js`.
   '.google.protobuf.Timestamp',
   '.google.type.Date',
   // `FieldMask` is special because it's the only "builtin" type that behaves
   // like an array. In proto, a `FieldMask` is a message that contains one
   // field: `repeated string paths`. So, you could accomplish the same thing
   // by just having a `repeated string whatever` instead of
   // `google.protobuf.FieldMask whatever`. `FieldMask` is here treated
   // specially in order to support convention and tooling that understands
   // `google.protobuf.FieldMask`.
   '.google.protobuf.FieldMask')
