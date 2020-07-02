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
mostly-flat protobuf messages into mostly-flat SQL tables. The one cool
thing that it supports is arrays of basic types or enum types.

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

### A Tour of the Code

#### `crud-languages/`
TODO

#### `sql-dialects/`
TODO

#### `schemas/`
TODO
