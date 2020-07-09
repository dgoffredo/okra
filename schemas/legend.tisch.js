// A "legend" describes the relationship between a message type and the
// corresponding database tables. Each message type is associated with a table
// whose rows are instances of that message type. Each enum type is associated
// with a table whose rows are the possible values enumerated. Each
// array-valued (repeated) message field is associated with a table that maps
// the message instance's ID to values for that field.
//
// This schema describes a legend.
({
    messageTypeName: String, // fully qualified, e.g. ".foo.bar.Shoe"
    tableName: String, // e.g. "shoe"
    // The `fieldSources` do not necessarily come in the same order as the
    // fields in the protobuf type. They correspond by name (`.fieldName`).
    fieldSources: [or({
        // Each non-array field has a column in the message's table.
        fieldName: String, // e.g. "color"
        columnName: String // e.g. "color"
    }, {
        // Each array field has a table that maps the message type table's ID
        // to one of the values of the field, e.g. "Shoe.parts" will have a
        // "shoe_parts" table with two columns: "shoe_id" and "value" (or maybe
        // "part_id" if part is an enum).
        fieldName: String, // name of the array-valued field, e.g. "parts"
        tableName: String, // the mapping table, e.g. "shoe_parts"
        columnName: String // value column in the mapping table, e.g. "value"
    }), ...etc]
})