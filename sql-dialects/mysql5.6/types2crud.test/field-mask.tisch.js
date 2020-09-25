// The output of `field-mask.proto` is expected to match this schema.
// The idea is that the field of type `FieldMask` (`UpdateItem.stuff`) is
// treated as if it were a `repeated string` field.
({
  ".foobar.UpdateItem": {
    create: [
      {
        instruction: "exec",
        sql: "insert into `update_item`( `id`) values (?);",
        parameters: [
          {
            field: "id"
          }
        ]
      },
      {
        instruction: "exec-with-tuples",
        condition: {
          included: "stuff"
        },
        tuple: "(?, ?)",
        sql: "insert into `update_item_stuff`( `id`, `value`) values",
        parameters: [
          {
            field: "id"
          },
          {
            field: "stuff"
          }
        ]
      }
    ],
    read: [
      {
        instruction: "query",
        sql: "select `id` from `update_item` where `id` = ?;",
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
        sql: "select `value` from `update_item_stuff` where `id` = ?;",
        parameters: [
          {
            field: "id"
          }
        ]
      },
      {
        instruction: "read-array",
        destination: {
          field: "stuff"
        }
      }
    ],
    update: [
      {
        instruction: 'query',
        sql: 'select null from `update_item` where `id` = ?;',
        parameters: [{field: 'id'}]
      },
      { instruction: 'read-row', destinations: [ 'ignore' ] },
      {
        instruction: "exec",
        sql: "update `update_item` set where `id` = ?;",
        parameters: [
          {
            field: "id"
          }
        ]
      },
      {
        instruction: "exec",
        sql: "delete from `update_item_stuff` where `id` = ?;",
        parameters: [
          {
            field: "id"
          }
        ],
        condition: {
          included: "stuff"
        }
      },
      {
        instruction: "exec-with-tuples",
        condition: {
          included: "stuff"
        },
        tuple: "(?, ?)",
        sql: "insert into `update_item_stuff`( `id`, `value`) values",
        parameters: [
          {
            field: "id"
          },
          {
            field: "stuff"
          }
        ]
      }
    ],
    delete: [
      {
        instruction: "exec",
        sql: "delete from `update_item_stuff` where `id` = ?;",
        parameters: [
          {
            field: "id"
          }
        ]
      },
      {
        instruction: "exec",
        sql: "delete from `update_item` where `id` = ?;",
        parameters: [
          {
            field: "id"
          }
        ]
      }
    ]
  }
})
