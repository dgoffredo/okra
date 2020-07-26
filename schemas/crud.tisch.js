// Each protobuf message has associated with it a set of procedures for
// creating, reading, updating, and deleting (CRUD) its representation in the
// database.
//
// Each procedure is composed of a sequence of "instructions" for executing SQL
// statements and unpacking the results into protocol buffer objects.
(function () {
    // A `parameter` refers to a field in a protobuf message, or refers to
    // whether that field is included in the current CRUD operation (sometimes
    // we're only interested in a subset of the message's fields).
    //
    // For example, a SQL dialect might emit the following query for the "read"
    // operation of a "Person" type:
    //
    //     select
    //       id as id,
    //       case when ? then name else null end as name,
    //       case when ? then age else null end as age
    //     from person
    //     where id = ?;
    //
    // The parameters for that instruction would be:
    //
    //     [
    //         {"included": "name"},
    //         {"included": "age"},
    //         {"field": "id"}
    //     ]
    //
    // Note that excluded fields will still be referenced as output parameters
    // in "read-row" and "read-array" instructions. It's up to the generated
    // CRUD code (e.g. Go, C++) to ignore output parameters of excluded fields.
    //
    // For example, a SQL dialect might emit the following "read-row"
    // instruction after the previous query:
    //
    //     {
    //         "instruction": "read-row",
    //         "destinations": [
    //             {"field": "id"},
    //             {"field": "name"},
    //             {"field": "age"}
    //         ]
    //     }
    //
    // If "age" is excluded from the "read" operation, then the generated code
    // has to know not the write a value into the "age" property, even though
    // "read-row" says to do so.
    const inputParameter = or(
        // protobuf field name as is appears in the `.proto` file
        {'field': String},

        // whether the field with the specified name is part of the operation.
        // A "read" operation might specify only a subset of fields to return,
        // and an "update" operation might specify only a subset of fields to
        // modify.
        {'included': String}
    );

    // Field name of the destination field.
    const outputParameter = {'field': String};

    const instruction = or(
        // Read-only SQL query.
        {
            'instruction': 'query',
            'sql': String,
            'parameters': [inputParameter, ...etc]
        },
    
        // Extract column values from the current result row, and advance to the
        // next row. If an excluded field is among the `destinations`, ignore
        // that field.
        {
            'instruction': 'read-row',
            'destinations': [outputParameter, ...etc]
        },
    
        // Extract the first column of all remaining rows, and append each value
        // to the array-valued `destination`. If the field `destination` is not
        // selected, then ignore this instruction.
        {
            'instruction': 'read-array',
            'destination': outputParameter
        },
    
        // Read/write SQL query. Not expected to produce any rows.
        {
            'instruction': 'exec',
            // Some statements are to be executed conditionally based on the
            // inclusion of a message field. For example, an "update" that
            // includes an array field will delete rows from the corresponding
            // array table and replace them with new values. However, if the
            // array field is not included, then the statement must not be
            // executed.
            'condition?': {'included': String},
            'sql': String,
            'parameters': [inputParameter, ...etc]
        },
    
        // Read/write SQL query. Not expected to produce any rows.
        //
        // This instruction was designed for the case where you are inserting
        // multiple rows into a table, e.g. to update an array-valued field. Such
        // a SQL statement will look something like:
        //
        //     insert into boyscout_badges(boyscout_id, badge_id)
        //     values (?, ?), (?, ?), (?, ?), (?, ?), ...
        //
        // where there's one "(?, ?)" per row, i.e. per value in the array-valued
        // field. In an `exec-with-tuples` instruction for the example above, the
        // `tuple` is "(?, ?)" and the `sql` is everything before the first "(?,
        // ?)". Exactly one of the `parameters` will be array-valued, and its
        // length determines the number of copies of `tuple`. Other parameters are
        // to be repeated for each element in the array-valued parameter (e.g. the
        // `boyscout_id` is always the same, while the `badge_id` varies with the
        // values in the array-valued parameter).
        //
        // If the array-valued field is empty, then do not execute the SQL.
        {
            'instruction': 'exec-with-tuples',
            // Some statements are to be executed conditionally based on the
            // inclusion of a message field. For example, an "update" that
            // includes an array field will delete rows from the corresponding
            // array table and replace them with new values. However, if the
            // array field is not included, then the statement must not be
            // executed.
            'condition?': {'included': String}, // _and_ nonempty
            'tuple': String,
            'sql': String,
            // I imagine that `parameters` will only ever contain
            // `{field: ...}` parameters, not `{included: ...}` parameters, but
            // still both are allowed.
            'parameters': [inputParameter, ...etc]
        });

    return {
        // Each property is the name of the message type whose CRUD operations
        // it describes. Enum types do not have CRUD operations.
        [Any]: {
            'create': [instruction, ...etc],
            'read': [instruction, ...etc],
            'update': [instruction, ...etc],
            'delete': [instruction, ...etc]
        },
        ...etc
    };
}())
