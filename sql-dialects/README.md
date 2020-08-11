SQL Dialects
=======
Each directory here contains the "backend" for SQL statements and CRUD
instructions in some dialect of SQL (e.g. MySQL, SQLite, SQL Server).

Each directory must contain the following two modules:
- `dbdiff2sql.js` must export a `function dbdiff2sql` of a single parameter,
  where the parameter adheres to the tisch schema
  [dbdiff.tisch.js](../schemas/dbdiff.tisch.js). `function dbdiff2sql` returns
  a string of SQL in the appropriate dialect that migrates a database in the
  manner described by the `dbdiff` argument.
- `types2crud.js` must export a `function types2crud` of a single parameter,
  where the parameter adheres to the following tisch schema:
  ```javascript
    ({
        // Each property is the name of the type it describes.
        [Any]: {
            'type': schemas.type, // either a message or an enum
            'legend?': schemas.legend // present if `type` is a message
        },
        ...etc
    })
  ```
  `function types2crud` returns an object adhering to the tisch schema
  [crud.tisch.js](../schemas/crud.tisch.js). Okra can then pass those CRUD
  operations to a CRUD backend (e.g. Go) to produce database accessor code.
