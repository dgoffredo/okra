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
TODO

![](images/dataflow.svg)

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
[crud-languages](crud-languages) contains TODO

#### `sql-dialects/`
[sql-dialects](sql-dialects) contains TODO

#### `lib/`
[lib](lib) contains TODO

#### `schemas/`
[schemas](schemas) contains TODO

[1]: https://github.com/nvm-sh/nvm
