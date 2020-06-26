CRUD Languages
=============
You have protocol buffer schemas (`.proto` files) describing your data model,
you have analogously shaped tables in your SQL database, and you have a tool
(Okra) that claims to be able to bridge the two, but what actually does the
conversion?

Your services, of course.

What programming language are your services written in? Well, it depends.
Hence this directory contains a language "backend" for each supported
programming language. The languages translate Okra CRUD
(create/read/update/delete) JSON programs into code modules that can be
used by a service implemented in a particular language.
