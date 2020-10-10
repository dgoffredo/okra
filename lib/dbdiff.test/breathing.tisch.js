({
    "allTables": {
        "foo": {
            "name": "foo",
            "description": "here's the new description",
            "primaryKey": ["id"],
            "columns": [
                {
                    "name": "id",
                    "type": "TYPE_INT32",
                    "nullable": false
                },
                {
                    "name": "fooness",
                    "type": "TYPE_DOUBLE",
                    "nullable": false,
                    "description": "maximum fooness!"
                },
                {
                    "name": "annex",
                    "type": "TYPE_STRING",
                    "nullable": true
                }
            ],
            "rows": [
                [
                    1,
                    1
                ],
                [
                    2,
                    1/1337
                ],
                [
                    3,
                    1/3
                ]
            ]
        },
        "chicken": {
            "name": "chicken",
            "columns": []
        }
    },
    "newTables": {
        "chicken": {
            "name": "chicken",
            "columns": []
        }
    },
    "modifications": {
        "foo": {
            "alterations": [
                {
                    "kind": "alterDescription",
                    "description": "here's the new description"
                },
                {
                    "kind": "appendColumn",
                    "name": "annex",
                    "type": "TYPE_STRING"
                },
                {
                    "kind": "alterColumn",
                    "name": "fooness",
                    "type": "TYPE_DOUBLE",
                    "nullable": false,
                    "description": "maximum fooness!"
                }
            ],
            "insertions": [],
            "updates": [
                {
                    "primaryKeyValue": 2,
                    "columnValues": {
                        "fooness": 1/1337
                    }
                }
            ]
        }
    }
})
