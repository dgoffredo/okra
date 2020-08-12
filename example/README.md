Example
=======
This directory contains a [makefile](Makefile) that generates MySQL 5.6
table definitions for [scouts.proto](scouts.proto) and then generates a Go
package, [crud](src/crud), that exports create/read/update/delete
operations for the types defined in the schema. The example
[program](src/main.go) connects to a local MySQL instance (which is assumed
to be configured in a particular way) and performs some operations using
the generated package.

Run `make run` if you're feeling lucky.
