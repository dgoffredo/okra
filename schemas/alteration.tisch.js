// "Alteration" as in the kinds of things you can do in a SQL "ALTER TABLE"
// statement.
define(['./builtin.tisch.js'], function (builtin) {
    return or(
        {
            'kind': 'alterColumn',
            // There are two modifications that can be made to an existing column:
            // - change to type, e.g. to widen an integer
            // - change the documentation
            'name': String,
            'type?': builtin,
            'description?': String // e.g. COMMENT section in MySQL
        },
        {
            'kind': 'appendColumn',
            // The rest of this is based on the definition of a column in
            // `table.tisch.js`, except that "nullable" is assumed to be true,
            // and "type" does not allow the value "name" (which is used only
            // for the "name" column in enum tables).
            'name': String,
            'type': builtin,
            'foreignKey?': {
                'table': String, // name of the foreign table
                'column': String  // name of the column in the foreign table
            },
            'description?': String // e.g. COMMENT section in MySQL
        },
        {
            'kind': 'alterDescription', // of the table
            // empty string means that it was removed
            'description': String
        });
})
