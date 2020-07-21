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
    // The `fieldSources` will come in the same order as the fields in the
    // protobuf type. They also correspond by name (`.fieldName`).
    fieldSources: [or({
        // Each non-array field has a column in the message's table.
        fieldName: String, // e.g. "color"
        columnName: String // e.g. "color"
    }, {
        // Each array field has a table that maps the message type table's ID
        // to one of the values of the field, e.g. "Shoe.parts" will have a
        // "shoe_parts" table with two columns: "id" and "value". "id" refers
        // to the primary key of the message table, and "value" is the value,
        // which may have a foreign key to an enum table it it's an enum.
        fieldName: String, // name of the array-valued field, e.g. "parts"
        tableName: String // the mapping table, e.g. "shoe_parts"
    }), ...etc]
})
