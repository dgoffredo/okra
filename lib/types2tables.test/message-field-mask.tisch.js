// The output of `message-field-mask.json.js` is expected to match this schema.
({
    tables: {
        "mirror": {
            name: "mirror",
            primaryKey: ["stonk"],
            columns: [
                {
                    name: "stonk",
                    nullable: false,
                    type: "name"
                }
            ],
            description: "up up up up"
        },
        "mirror_stuff": {
            name: "mirror_stuff",
            primaryKey: ["id", "ordinality"],
            columns: [
                {
                    name: "id",
                    type: "name",
                    nullable: false,
                    foreignKey: {
                        table: "mirror",
                        column: "stonk"
                    },
                    description: "stonk of the relevant .stonks.Mirror"
                },
                {
                    name: "ordinality",
                    type: "TYPE_UINT32",
                    nullable: false,
                    description: String
                },
                {
                    name: "value",
                    type: "name",
                    nullable: true,
                    description: "one of the fields named by stuff in some .stonks.Mirror"
                }
            ]
        }
    },
    legends: {
        ".stonks.Mirror": {
            messageTypeName: ".stonks.Mirror",
            tableName: "mirror",
            fieldSources: [
                {
                    fieldName: "stonk",
                    columnName: "stonk"
                },
                {
                    fieldName: "stuff",
                    tableName: "mirror_stuff"
                }
            ]
        }
    }
})
