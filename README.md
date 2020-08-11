<img align="right" width="300" src="images/okra.svg"/>

okra
====
the **ok**ay **r**elational **a**utomator

Why
---
I want to generate database tables and CRUD operations for my protobuf
messages.

What
----
Okra is a lobotomized object relational mapper (ORM). Its input is a
protocol buffer schema and its output is a set of SQL tables in some
database together with functions for marshaling objects into and out of the
database in some programming language.

It doesn't support messages-in-messages, or anything cool. It just maps
mostly-flat protobuf messages into mostly-flat SQL tables. The two cool
things that it supports are enum types and arrays of basic types or of enum
types.

How
---
![](images/dataflow.svg)

`.proto` files go in,  SQL or CRUD code comes out.

The command line interface is the script `bin/okra`. It's a multi-tool with two
subcommands:
- `okra migrate` produces SQL reflecting modifications to specified `.proto`
  files.
- `okra crud` produces create/read/update/delete (CRUD) database accessor code
  in some programming language. Currently only Go is supported.

```console
$ bin/okra -h
usage: okra [-h] {migrate,crud} ...

SQL support for protobol buffers

positional arguments:
  {migrate,crud}
    migrate       generate SQL for proto schema
    crud          generate code for create/read/update/delete

optional arguments:
  -h, --help      show this help message and exit
```

```console
$ bin/okra migrate -h
usage: okra migrate [-h] [-I INCLUDE_PATHS] [--dialect {mysql5.6}] [--id_fields ID_FIELDS]
                    [--root_type ROOT_TYPES]
                    from proto [proto ...]

positional arguments:
  from                  git refspec from which to migrate (or "-" to generate from scratch)
  proto                 protocol buffer schema file (.proto)

optional arguments:
  -h, --help            show this help message and exit
  -I INCLUDE_PATHS, --proto_path INCLUDE_PATHS
                        directory to search for .proto files; may be specified more than once
  --dialect {mysql5.6}  SQL dialect to generate ("mysql5.6" by default)
  --id_fields ID_FIELDS
                        JSON object mapping type names to ID field names
  --root_type ROOT_TYPES
                        protocol buffer type to include in output
```

```console
$ bin/okra crud -h
usage: okra crud [-h] [--language {go}] [-I INCLUDE_PATHS] [--dialect {mysql5.6}] [--id_fields ID_FIELDS]
                 [--root_type ROOT_TYPES]
                 proto [proto ...]

positional arguments:
  proto                 protocol buffer schema file (.proto)

optional arguments:
  -h, --help            show this help message and exit
  --language {go}       programming language to generate ("go" by default)
  -I INCLUDE_PATHS, --proto_path INCLUDE_PATHS
                        directory to search for .proto files; may be specified more than once
  --dialect {mysql5.6}  SQL dialect to generate ("mysql5.6" by default)
  --id_fields ID_FIELDS
                        JSON object mapping type names to ID field names
  --root_type ROOT_TYPES
                        protocol buffer type to include in output
```

The resulting SQL or Go code is printed to standard output.

More
----
### Dependencies
- Node.js v12
- protoc (the protocol buffer compiler and its Python libraries)
- Python 3
- git submodules under [dependencies/](dependencies/)

[bin/check-dependencies](bin/check-dependencies) will report whether your
system is missing any of the dependencies.

### Installing Dependencies on a Debian-based Linux
[bin/update-node](bin/update-node) installs [nvm][1], the Node Version
Manager, and uses it to install the most recent long term support (LTS)
version of node, which is v12 or greater.

The protocol buffer compiler, Python 3, and the Python 3 bindings to the
protocol buffer compiler can be installed using `apt`:
```console
$ sudo apt install -y protobuf-compiler python3 python3-protobuf
```

### A Tour of the Code

#### `crud-languages/`
[crud-languages](crud-languages) contains one directory for each CRUD language
supported by Okra. A CRUD language translates a description of types and
database operations into code in some programming language that will
create/read/update/delete instances of those types in a SQL database.

Currently only Go is implemented.

#### `sql-dialects/`
[sql-dialects](sql-dialects) contains one directory for each SQL dialect
supported by Okra. A SQL dialect translates a description of types and tables
into SQL code that creates and/or modifies those tables in a SQL database,
and additionally into database operations that a CRUD language can then use
to generate CRUD code.

#### `lib/`
[lib](lib) contains code independent of a particular CRUD language or SQL
dialect.

#### `schemas/`
[schemas](schemas) contains [tisch][2] schemas that describe the structure
(shape) of function arguments and results used within Okra. The modules in
`lib/`, as well as those in `crud-languages` and `sql-dialects`, consume and
produce objects that satisfy some schema within `schemas/`. It is effectively
the type system used by this project.

[Typescript interfaces][3] would be a reasonable replacement.

[1]: https://github.com/nvm-sh/nvm
[2]: https://github.com/dgoffredo/tisch
[3]: https://www.typescriptlang.org/docs/handbook/interfaces.html