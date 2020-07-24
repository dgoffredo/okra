// This schema describes a Go source file. It isn't a full abstract syntax
// tree (AST) like the kind that is needed by a compiler. Instead, it's just
// enough information to make rendering Go code for Okra neater than a rat's
// nest of template strings.
(function () {
    const statement = or(
        {'raw': String}, // any code at all
        {'assignment': {
            'left': [String, ...etc], // variable names
            'right': String // any expression
        }},
        {'if': {
            'condition': String,
            // "body" is actually an array of statements, not of anything, but
            // tisch doesn't support recursive types, so this will have to do.
            'body': [Any, ...etc]
        }},
        {'rangeFor': {
            // for $variableName := $sequence {
            //     $body
            // }
            'variableName': String,
            'sequence': String,
            'body': [Any, ...etc] // statements, same as in "if" above
        }});

    const file = {
        'package': String, // e.g. "foo" in "package foo"
        'imports': [{
            'package': String, // e.g. "google/protobuf/timestamp"
             'alias?': String // e.g. "pb" in 'import pb "services/types/proto"'
        }, ...etc],
        'functions': [{
            'name': String,
            'arguments': [{'name': String, 'type': String}, ...etc],
            'result': [{'name?': String, 'type': String}, ...etc],
            'body': {
                'variables': [{
                    'name': String,
                    'type': String,
                    'value?': String
                }, ...etc],
                'body': [statement, ...etc]
            }
        }, ...etc]
    };

    return file;
}())
