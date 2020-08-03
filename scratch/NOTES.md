Notes
=====
Use Python for command line parsing, and then forward to node using
`os.execlp`.

### Development Workflow
- edit proto file(s)
- generate SQL from proto(s)
    - execute it on dev
- generate CRUD from proto(s)
    - compile/run on dev

#### Command Line interface
```console
$ okra sql-new PROTOS ...
create table blah(...)
...

$ okra sql-migrate REFSPEC PROTOS ...
insert into foo(x, y) values(...)
...

$ okra go PROTOS ...
package crud

import (
    ...

$ okra python-json PROTOS ...
"""create/read/update/delete proto-based database objects
...
"""

import json
...

$ okra python-json --dialect sqlite
```

### Deployment Workflow
- propose pull request containing:
    - proto file(s) changes
    - generated CRUD changes
    - other manual changes
    - generated SQL
- once changes are approved:
    - execute the generated SQL on production
    - merge the PR into master (what about commit ID in SQL?)
    - deploy the affected artifacts (e.g. services)

### Tools

    okra-types :: okra args -- protoc command line args → [types]
        The okra args specify root types (e.g. don't generate tables for RPC
        request/response types.

        Comments:
        - leadingDetachedComments
        - leadingComments
        - trailingComments
        - join them all together with newlines, in the order above

        Annotating primary key:
        - if the type name is in the "primaryKeys" option, use that
        - if there's an `id` column (case-insensitive), use that
        - otherwise, error

        Types:
        - enum yields enum
        - message yields message
        - field types translated per the comments in type.tisch.js
        - the names of types are fields are as in the original (non-JSON)
            - it's the job of the SQL dialect backends to change the names
            - note to self: the CRUD generator needs a SQL dialect


    okra-tables :: [types] → [tables]

    okra-crud :: TODO

### `okra-types`
TODO