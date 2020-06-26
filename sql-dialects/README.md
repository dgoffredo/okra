SQL Dialects
============
SQL is not a language, it's an idea. Ok, it's a language. It's a language
without an implementation. Ok, it has implementations. It's a language without
a conforming implementation. Ok, PostgreSQL claims to be ISO-conforming. But
you're not using PostgreSQL, are you? I bet you're using MySQL. I bet you're
using an _old_ version of MySQL.

Regardless of which relational database you're using, the SQL language
standard won't be of any use to you. Instead, each database has its own
dialect "backend" in this directory. The dialects translate Okra tables into
SQL statements appropriate for use with a particular database.
