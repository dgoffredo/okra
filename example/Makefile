ALL = scouts.sql src/boyscouts.com/type/scouts/scouts.pb.go src/crud/crud.go
CODE := $(shell find ../ -type f -name '*.js')

.PHONY: all clean run

all: $(ALL)

clean:
	-rm -f $(ALL)

run: $(ALL)
	GOPATH=$$(pwd) go run src/main.go

scouts.sql: src/boyscouts.com/type/scouts/scouts.proto $(CODE) ../bin/proto2sql
	echo 'start transaction;' >$@
	echo '' >>$@
	../bin/okra migrate - -I src $< >>$@
	echo 'commit;' >>$@

src/boyscouts.com/type/scouts/scouts.pb.go: src/boyscouts.com/type/scouts/scouts.proto
	protoc --go_out=src -I$$(pwd)/src -I$$(pwd) $<

src/crud/crud.go: src/boyscouts.com/type/scouts/scouts.proto $(CODE)
	../bin/okra crud -I src $< >$@
	GOPATH=$$(pwd) gofmt -s -w $@