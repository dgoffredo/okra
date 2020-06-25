// Each protobuf message has associated with it a set of procedures for
// creating, reading, updating, and deleting (CRUD) its representation in the
// database.
//
// Each procedure is composed of a sequence of operations for executing SQL
// statements and unpacking the results into protocol buffer objects.
//
// This schema describes an operation.
//
or(
    // Read-only SQL query. The `parameters` are input parameters.
    {
        'operation': 'query',
        'sql': String,
        'parameters': [String, ...etc] // protobuf field names
    },

    // Extract column values from the current result row, and advance to the
    // next row.
    {
        'operation': 'read-row',
        'destinations': [String, ...etc] // protobuf field names
    },

    // Extract the first column of all remaining rows, and append each value
    // to the array-valued `destination`.
    {
        'operation': 'read-array',
        'destination': String // protobuf field name
    },

    // Read/write SQL query. Not expected to produce any rows. The
    // `parameters` are input parameters.
    {
        'operation': 'exec',
        'sql': String,
        'parameters': [String, ...etc] // protobuf field names
    },

    // Read/write SQL query. Not expected to produce any rows.
    //
    // This operation was designed for the case where you are inserting
    // multiple rows into a table, e.g. to update an array-valued field. Such
    // a SQL statement will look something like:
    //
    //     insert into boyscout_badges(boyscout_id, badge_id)
    //     values (?, ?), (?, ?), (?, ?), (?, ?), ...
    //
    // where there's one "(?, ?)" per row, i.e. per value in the array-valued
    // field. In an `exec-with-tuples` operation for the example above, the
    // `tuple` is "(?, ?)" and the `sql` is everything before the first "(?,
    // ?)". Exactly one of the `parameters` will be array-valued, and its
    // length determines the number of copies of `tuple`. Other parameters are
    // to be repeated for each element in the array-valued parameter (e.g. the
    // `boyscout_id` is always the same, while the `badge_id` varies with the
    // values in the array-valued parameter).
    {
        'operation': 'exec-with-tuples',
        'tuple': String,
        'sql': String,
        'parameters': [String, ...etc] // protobuf field names
    }
)