// This schema describes a Go source file. It isn't a full abstract syntax
// tree (AST) like the kind that is needed by a compiler. Instead, it's just
// enough information to make rendering Go code for Okra neater than a rat's
// nest of template strings.
(function () {
    // e.g. if we have [$a, $b, $c], then
    // $a.$b.$c
    const dot = {'dot': [String, ...etc(1)]};

    // e.g. the name of a variable
    const symbol = {'symbol': String};

    const {expression, index, statement} =
        recursive(({expression, index, statement}) => ({
        // $object[$index]
        index: {'index': {
            'object': or(String, dot),
            'index': expression
        }},

        expression: or(
            // any code at all, expanded verbatim into the .go file
            {'raw': String},
    
            // 34.54, -11, 3.454e-23
            Number,
    
            // "\"quoted\" as JSON, which is compatible with Go string
            // literals" That is, the generator will do the quoting. The
            // `String` expression does not have to be JSON serialized to begin
            // with.
            String,
    
            // true, false
            Boolean,
    
            // nil
            null,
    
            // e.g. the name of a variable
            symbol,
    
            // $function($arguments)
            {'call': {
                'function': or(String, dot),
                'arguments': [expression, ...etc],
                // optional trailing variadic argument, e.g. `wakka` in
                //     foo(bar, baz, wakka...)
                'rest?': expression
            }},
    
            // $type{$elements}
            // or
            // {$elements}
            {'sequenceLiteral': {
                'type?': String,
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
            {'and': {'left': expression, 'right': expression}},
            
            // ! ...
            {'not': expression},
            
            // $object[$index]
            index,

            // func($arg) { $body }
            {'unaryOneLineCallback': {
                'argument': {
                    'name': String,
                    'type': or(dot, String)
                },
                'body': statement
            }}),

        statement: or(
            // see `expression`, defined above
            expression,
    
            // $left = $right
            {'assign': {
                'left': [or(String, dot, index, symbol), ...etc],
                'right': [expression, ...etc]
            }},
    
            // $left = func($parameters) $results {
            //     $body
            // }
            {'assignFunc': {
                'left': or(String, dot, index, symbol),
                'parameters': [{'name?': String, 'type': String}, ...etc],
                'results': [{'name?': String, 'type': String}, ...etc],
                'body': [statement, ...etc]
            }},
    
            // if $condition {
            //     $body
            // }
            //
            // or
            //
            // if $condition {
            //     $body
            // }
            // else {
            //     $elseBody
            // }
            {'if': {
                'condition': expression,
                'body': [statement, ...etc],
                'elseBody?': [statement, ...etc]
            }},
    
            {'rangeFor': {
                // for $variables := range $sequence {
                //     $body
                // }
                'variables': [String, ...etc],
                'sequence': expression,
                'body': [statement, ...etc]
            }},
    
            {'conditionFor': {
                // for $condition {
                //     $body
                // }
                'condition': expression,
                'body': [statement, ...etc]
            }},
    
            {'iterationFor': {
                // for $init; $condition; $post {
                //     $body
                // }
                'init?': statement,
                'condition?': expression,
                'post?': statement,
                'body': [statement, ...etc]
            }},
            
            // return $expression, ...
            {'return': [expression, ...etc]},
    
            // a `spacer` is used to emit the specified number of empty lines, for
            // separating logical sections of code within a block.
            {'spacer': Number},
            
            // Most variable declarations go at the top of the function, in a
            // dedicated section (and are not considered statements). However,
            // sometimes it's convenient to declare a variable for temporary use,
            // so the `variable` statement is allowed.
            //
            // var $name $type = $value
            {'variable': {
                'name': String,
                'type': String,
                'value?': expression
            }},
            
            // defer $expression
            {'defer': expression},
             
            // A `thunk` is a zero-parameter function meant to be used as a
            // callback. Here we combine it with Go's `defer` statement to create
            // a dedicated statement similar to D's `scope(exit)`.
            // 
            //     defer func() {
            //         $statement ...
            //     }()
            {'deferThunk': [statement, ...etc]})
    }));

    const file = {
        'documentation?': String, // commented per-line
        'package': String, // the name of the package
        'imports': {
            // The keys are full package name, e.g. "google/protobuf/timestamp"
            // The values are package aliases, e.g. "pb" in
            // 'import pb "services/types/proto"', or `null` for no alias.
            [Any]: or(String, null),
            ...etc
        },
        'declarations': [or({
            // func $name($parameters) $results {
            //     $body
            // }
            'function': {
                'documentation?': String, // commented per-line
                'name': String,
                'parameters': [{'name?': String, 'type': String}, ...etc],
                'results': [{'name?': String, 'type': String}, ...etc],
                'body': {
                    // In this subset of Go, most variables used in a function
                    // are declared at the top of the function before any other
                    // statements, just like good old C89.
                    // There are a couple exceptions: loop variables and
                    // temporaries used for database value scanning.
                    'variables': [{
                        'name': String,
                        'type': String,
                        'value?': expression,
                        // optionally a `defer func() {...}()` for cleanup
                        'defer?': [statement, ...etc]
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
