.PHONY: all
all: scouts.sql src/boyscouts.com/type/scouts/scouts.pb.go

scouts.sql: src/boyscouts.com/type/scouts/scouts.proto ../lib/*.js ../bin/proto2sql
	echo 'start transaction;' >$@
	echo '' >>$@
	../bin/proto2sql --json '{"protoFiles": ["$<"], "protoIncludePaths": ["src"]}' >>$@
	echo 'commit;' >>$@

src/boyscouts.com/type/scouts/scouts.pb.go: src/boyscouts.com/type/scouts/scouts.proto
	protoc --go_out=src -I$$(pwd)/src -I$$(pwd) $<
