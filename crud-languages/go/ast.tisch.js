// This schema describes a Go source file. It isn't a full abstract syntax
// tree (AST) like the kind that is needed by a compiler. Instead, it's just
// enough information to make rendering Go code for Okra neater than a rat's
// nest of template strings.
(function () {
    // e.g. if we have [$a, $b, $c], then
    // $a.$b.$c
    const dot = {'dot': [String, ...etc]};

    const expression = recursive(expression => or(
        // any code at all, expanded verbatim into the .go file
        {'raw': String},

        // 34.54, -11, 3.454e-23
        Number,

        // "\"quoted\" as JSON, which is compatible with Go string literals"
        // That is, the generator will do the quoting. The `String` expression
        // does not have to be JSON serialized to begin with.
        String,

        // true, false
        Boolean,

        // nil
        null,

        // e.g. the name of a variable
        {'symbol': String},

        // $function($arguments)
        {'call': {
            'function': or(String, dot),
            'arguments': [expression, ...etc]
        }},

        // $type{$elements}
        // or
        // {$elements}
        {'slice': {
            'type?': String, // name of the slice type
            'elements': [expression, ...etc]
        }},

        // a.b.c
        dot,
        
        // &foo
        {'address': expression},
        
        // $left == $right
        {'equal': {'left': expression, 'right': expression}},

        // $left != $right
        {'notEqual': {'left': expression, 'right': expression}},

        // $left && $right
        {'and': {'left': expression, 'right': expression}}));

    const statement = recursive(statement => or(
        // see `expression`, defined above
        expression,

        // $left = $right
        {'assignment': {
            'left': [String, ...etc], // variable names
            'right': [expression, ...etc]
        }},

        // if $condition {
        //     $body
        // }
        {'if': {
            'condition': expression,
            'body': [statement, ...etc]
        }},

        {'rangeFor': {
            // for $variableName := range $sequence {
            //     $body
            // }
            'variables': [String, ...etc],
            'sequence': expression,
            'body': [statement, ...etc]
        }},
        
        // return $expression, ...
        {'return': [expression, ...etc]}));

    const file = {
        'documentation?': String, // commented per-line
        'package': String, // the name of the package
        'imports': {
            // The keys are full package name, e.g. "google/protobuf/timestamp"
            // The values are package aliases, e.g. "pb" in
            // 'import pb "services/types/proto"', or `null` for no alias.
            [Any]: or(String, null)
        },
        'declarations': [or({
            // func $name($arguments) $results {
            //     $body
            // }
            'function': {
                'documentation?': String, // commented per-line
                'name': String,
                'arguments': [{'name?': String, 'type': String}, ...etc],
                'results': [{'name?': String, 'type': String}, ...etc],
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
                        'value?': expression
                    }, ...etc],
                    'statements': [statement, ...etc]
                }
            }},

            // Included in the output source verbatim. This is used for
            // predetermined snippets of Go code that do not depend on the
            // input, such as utility functions and types.
            {'raw': String}),
        ...etc]
    };

    return file;
}())
