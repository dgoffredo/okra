// This module provides a function, `renderFile`, that takes the AST describing
// a file of Go code (see `ast.tisch.js`), and returns a string containing Go
// source code.
define(['../../dependencies/tisch/tisch'], function (tisch) {

const isGoFileAst = tisch.compileFile(`${__dirname}/ast.tisch.js`);

function linePrinter({lines=[], indentLevel=0, tab='\t'}={}) {
    return {
        push: function (...linesToAdd) {
            lines.push(...linesToAdd.map(
                line => `${tab.repeat(indentLevel)}${line}`));
        },
        indented: function () {
            return linePrinter({lines, indentLevel: indentLevel + 1, tab});
        },
        render: function () {
            return lines.join('\n');
        }
    };
}

// Render each line of the specified `text` string as a line comment.
function renderDocumentation(text, lines) {
    lines.push(...text.split('\n').map(line => `// ${line}`))
}

function stringifyExpression(expression) {
    if (expression === null) {
        return 'nil';
    }
    else if (typeof expression === 'number') {
        return expression.toString();
    }
    else if (typeof expression === 'string') {
        return str(expression);
    }
    else if (typeof expression === 'boolean') {
        return expression.toString();
    }
    else if ('raw' in expression) {
        return expression.raw;
    }
    else if (expression.symbol) {
        return expression.symbol;
    }
    else if (expression.call) {
        const {function: func, arguments} = expression.call;
        const funcStr = typeof func === 'string'
            ? stringifyExpression({symbol: func})
            : stringifyExpression(func); // it's a "dot," e.g. foo.bar.baz
        return `${funcStr}(${arguments.map(stringifyExpression).join(', ')})`;
    }
    else if (expression.slice) {
        const type = expression.slice.type || '';
        const elements = expression.slice.elements;
        return `${type}{${elements.map(stringifyExpression).join(', ')}}`;
    }
    else if (expression.dot) {
        return expression.dot.join('.');
    }
    else if (expression.address) {
        return `&${stringifyExpression(expression.address)}`;
    }
    else if (expression.equal) {
        const {left, right} = expression.equal;
        return [left, right].map(stringifyExpression).join(' == ');
    }
    else if (expression.notEqual) {
        const {left, right} = expression.notEqual;
        return [left, right].map(stringifyExpression).join(' != ');
    }
    else {
        throw Error(`Invalid AST expression: ${JSON.stringify(expression)}`);
    }
}

// Go string literals are compatible with JSON (according to my reading of
// both specs, anyway). At least they're consistent for quoting the SQL
// statements we need here.
function str(text) {
    return JSON.stringify(text);
}

function stringifyArgument({name, type}) {
    if (name) {
        return `${name} ${type}`;
    }
    else {
        return type;
    }
}

function renderVariable({name, type, value}, lines) {
    // Since a variable is something like
    //     var foo type = value
    // we can reuse the "foo type" as rendered for function arguments.
    const argument = stringifyArgument({name, type});
    if (value === undefined) {
        lines.push(`var ${argument}`);
    }
    else {
        // This reminds me that we assume that an "expression" doesn't span
        // multiple lines. In Go this isn't true; for example, an anonymous
        // `func` is an expression. However, for the purposes of this AST we
        // can assume that an expression renders to source code without any
        // newlines.
        lines.push(`var ${argument} = ${stringifyExpression(value)}`);
    }
}

function stringifyAssignment({left: leftVars, right: rightExprs}) {
    const leftHandSide = leftVars.join(', ');
    const rightHandSide = rightExprs.map(stringifyExpression).join(', ');
    return `${leftHandSide} = ${rightHandSide}`;
}

function renderIf({condition: conditionExpr, body}, lines) {
    lines.push(`if ${stringifyExpression(conditionExpr)} {`);
    body.forEach(statement =>
        renderStatement(statement, lines.indented()));
    lines.push('}');
}

function renderRangeFor({variables, sequence, body}, lines) {
    lines.push(`for ${variables.join(', ')} := range ${stringifyExpression(sequence)} {`);
    body.forEach(statement =>
        renderStatement(statement, lines.indented()));
    lines.push('}');
}

function stringifyReturn(expressions) {
    return `return ${expressions.map(stringifyExpression).join(', ')}`;
}

function renderStatement(statement, lines) {
    if (statement.assignment) {
        lines.push(stringifyAssignment(statement.assignment));
    }
    else if (statement.if) {
        renderIf(statement.if, lines);
    }
    else if (statement.rangeFor) {
        renderRangeFor(statement.rangeFor, lines);
    }
    else if (statement.return) {
        stringifyReturn(statement.return);
    }
    else {
        lines.push(stringifyExpression(statement));
    }
}

function renderFunction(func, lines) {
    // See `ast.tisch.js` for the shapes of `arguments`, `variables`, etc.
    const {
        documentation,
        name,
        arguments,
        results,
        body: {
            variables,
            statements
        }
    } = func;

    if (documentation !== undefined) {
        renderDocumentation(documentation, lines);
    }

    // func $name($arguments) $results {
    //     $variables
    //     $statements
    // }
    const resultTuple = results.length === 0
        ? ''
        : `(${resultTuple.map(stringifyArgument).join(', ')}) `; // +extra space 

    lines.push(`func ${name}(${arguments.map(stringifyArgument).join(', ')}) ${resultTuple}{`);
    variables.forEach(variable => renderVariable(variable, lines.indented()));

    // Use a blank line to separate the variables section from the statements
    // section, but only if neither is empty.
    if (variables.length > 0 && statements.length > 0) {
        lines.push('');
    }

    statements.forEach(statement => renderStatement(statement, lines.indented()));
    lines.push('}');
}

function renderFile(goFile, lines) {
    isGoFileAst.enforce(goFile);

    if ('documentation' in goFile) {
        renderDocumentation(goFile.documentation, lines);
    }

    // package foo
    lines.push(`package ${goFile.package}`);

    // import (
    //     thing "path/to/thing/package"
    //     "some/other/package"
    // )
    if (Object.keys(goFile.imports).length > 0) {
        lines.push('');
        lines.push('import (');
        lines.indented().push(...Object.keys(goFile.imports).sort().map(package => {
            const alias = goFile.imports[package];
            if (alias !== null) {
                return `${alias} ${str(package)}`;
            }
            else {
                return `${str(package)}`;
            }
        }));
        lines.push(')')
    }

    // func foo(...) ... {
    //     ...
    // }
    // ...
    // type bar struct {
    //     ...
    // }
    // ...
    goFile.declarations.forEach(declaration => {
        lines.push('');
        if (declaration.function) {
            renderFunction(declaration.function, lines);
        }
        else {
            // `lines` will still apply indentation logic to the first line of
            // `declaration.raw`, but since `goFile` is rendered at indentation
            // level zero, it doesn't matter. The code will appear in the
            // output unmodified.
            lines.push(declaration.raw);
        }
    });
}

return {
    // Return a string of Go source code rendered from the specified `goFile`
    // AST.
    renderFile: function (goFile) {
        const lines = linePrinter();
        renderFile(goFile, lines);
        return lines.render();
    }
};
});
