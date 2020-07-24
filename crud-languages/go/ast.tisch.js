// This schema describes a Go source file. It isn't a full abstract syntax
// tree (AST) like the kind that is needed by a compiler. Instead, it's just
// enough information to make rendering Go code for Okra neater than a rat's
// nest of template strings.
(function () {
    const expression = recursive(expression => or(
        // any code at all, expanded verbatim into the .go file
        {'raw': String},

        // 34.54, -11, 3.454e-23
        Number,

        // "\"quoted\" as JSON, which is compatible with Go string literals"
        // That is, the generator will do the quoting. The `String` expression
        // does not have to be JSON serialized to begin with.
        String,

        // rendered as nil
        null,

        // e.g. the name of a variable
        {'symbol': String},

        // $function($arguments)
        {'call': {
            'function': String, // name of the function to call
            'arguments': [expression, ...etc]
        }},

        // $type{$elements}
        // or
        // {$elements}
        {'slice': {
            'type?': String, // name of the slice type
            'elements': [expression, ...etc]
        }},

        // e.g. if we have [$a, $b, $c], then
        // $a.$b.$c
        {'.': [expression, ...etc]}));

    const statement = recursive(statement => or(
        // see `expression`, defined above
        expression,

        // $left = $right
        {'assignment': {
            'left': [String, ...etc], // variable names
            'right': expression
        }},

        // if $condition {
        //     $body
        // }
        {'if': {
            'condition': String,
            'body': [statement, ...etc]
        }},

        {'rangeFor': {
            // for $variableName := range $sequence {
            //     $body
            // }
            'variableName': String,
            'sequence': String,
            'body': [statement, ...etc]
        }}));

    const file = {
        'package': String, // the name of the package
        'imports': [{
            'package': String, // e.g. "google/protobuf/timestamp"
             'alias?': String // e.g. "pb" in 'import pb "services/types/proto"'
        }, ...etc],
        'functions': [{
            'name': String,
            'arguments': [{'name': String, 'type': String}, ...etc],
            'result': [{'name?': String, 'type': String}, ...etc],
            'body': {
                // In this subset of Go, all variables used in a function
                // (except loop variables) are declared at the top of the
                // function before any other statements, just like good old
                // C89.
                'variables': [{
                    // $var $type
                    // or
                    // $var $type = $value
                    'name': String,
                    'type': String,
                    'value?': String
                }, ...etc],
                'statements': [statement, ...etc]
            }
        }, ...etc]
    };

    return file;
}())
