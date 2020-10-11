// This is the expected output of running the `types2crud` function on
// `enum-array-fields.proto`.
({
    ".foobar.Grill": {
        create: [
            {
                instruction: "exec",
                sql: "insert into `grill`( `id`) values (?);",
                parameters: [
                    {
                        field: "id"
                    }
                ]
            },
            {
                instruction: "exec-with-tuples",
                condition: {
                    included: "hotdog"
                },
                tuple: "(?, ?, ?)",
                sql: "insert into `grill_hotdog`( `id`, `ordinality`, `value`) values",
                parameters: [
                    {
                        field: "id"
                    },
                    {
                        index: "hotdog"
                    },
                    {
                        field: "hotdog"
                    }
                ]
            }
        ],
        read: [
            {
                instruction: "query",
                sql: "select `id` from `grill` where `id` = ?;",
                parameters: [
                    {
                        field: "id"
                    }
                ]
            },
            {
                instruction: "read-row",
                destinations: [
                    {
                        field: "id"
                    }
                ]
            },
            {
                instruction: "query",
                sql: "select `value` from `grill_hotdog` where `id` = ? order by `ordinality`;",
                parameters: [
                    {
                        field: "id"
                    }
                ]
            },
            {
                instruction: "read-array",
                destination: {
                    field: "hotdog"
                }
            }
        ],
        update: [
            {
                instruction: 'query',
                sql: 'select null from `grill` where `id` = ?;',
                parameters: [{field: "id"}]
            },
            { instruction: 'read-row', destinations: [ 'ignore' ] },
            // Since there are no "grill" columns to update, there's no
            // "update" here.
            {
                instruction: "exec",
                sql: "delete from `grill_hotdog` where `id` = ?;",
                parameters: [
                    {
                        field: "id"
                    }
                ],
                condition: {
                    included: "hotdog"
                }
            },
            {
                instruction: "exec-with-tuples",
                condition: {
                    included: "hotdog"
                },
                tuple: "(?, ?, ?)",
                sql: "insert into `grill_hotdog`( `id`, `ordinality`, `value`) values",
                parameters: [
                    {
                        field: "id"
                    },
                    {
                        index: "hotdog"
                    },
                    {
                        field: "hotdog"
                    }
                ]
            }
        ],
        delete: [
            {
                instruction: "exec",
                sql: "delete from `grill_hotdog` where `id` = ?;",
                parameters: [
                    {
                        field: "id"
                    }
                ]
            },
            {
                instruction: "exec",
                sql: "delete from `grill` where `id` = ?;",
                parameters: [
                    {
                        field: "id"
                    }
                ]
            }
        ]
    }
})
