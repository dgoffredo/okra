// "dbdiff" stands for "database difference."
//
// Migrating the database schema from one version to another might involve:
// - adding tables (e.g. a new type or a new array-valued field)
// - adding columns to existing tables (e.g. new field in a message)
// - modifying existing columns (e.g. expanding an int type or changing a comment)
// - adding rows to existing tables (e.g. new enum values)
// - modifying existing rows in tables (e.g. changing the description of an enum value)
//
// The set of all of those possiblities is described by this schema.
define(['./table.tisch.js', './alteration.tisch.js'], function (table, alteration) {
    return {
        // All of the tables, new and old, modified and untouched.
        // The keys of "all_tables" are the table names.
        // This is here so that a SQL code generator can look up information
        // about existing tables, e.g. the type of a primary key column.
        'allTables': {
            [Any]: table,
            ...etc
        },

        // Tables to add. The keys of "new_tables" are the table names.
        'newTables': {
            [Any]: table,
            ...etc
        },

        // Modifications to perform on existing tables. The keys of
        // "modifications" are table names. The object at each key describes
        // the modifications to make to the table whose name is that key.
        'modifications': {
            [Any]: {
                // DDL operations, e.g. adding a column. See `alteration.tisch.js`.
                'alterations': [alteration, ...etc],

                // Rows to add. Each row is an array of values. The order of
                // values in each row is the same as the order of the columns
                // in the table definition.
                'insertions': [Array, ...etc],

                // Existing rows to update.
                'updates': [{
                    // value in the primary key column of the row to modify;
                    // this is used in the INSERT statement's WHERE clause.
                    // Tables whose rows we modify will always have a primary
                    // key consisting of a single column.
                    'primaryKeyValue': or(Number, String),
                    // columns to update, and which values to set them to;
                    // each entry is a (column_name, new_value) pair.
                    'columnValues': {
                        [Any]: or(Number, String, null),
                        ...etc(1)
                    }
                }, ...etc]
            },
            ...etc
        }
    };
})
