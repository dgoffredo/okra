scouts.sql: src/boyscouts.com/type/scouts/scouts.proto ../lib/*.js ../bin/proto2sql
	echo 'start transaction;' >$@
	echo '' >>$@
	../bin/proto2sql --json '{"protoFiles": ["$<"], "protoIncludePaths": ["src"]}' >>$@
	echo 'commit;' >>$@
