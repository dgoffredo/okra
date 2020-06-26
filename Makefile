images/dataflow.svg: images/dataflow.dot
	dot -Tsvg <$^ >$@
