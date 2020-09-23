// This module provides a function, `renderFile`, that takes the AST describing
// a file of Go code (see `ast.tisch.js`), and returns a string containing Go
// source code.
define(['../../dependencies/tisch/tisch'], function (tisch) {

const isGoFileAst = tisch.compileFile(`${__dirname}/ast.tisch.js`);

function linePrinter({lines=[], indentLevel=0, tab='\t'}={}) {
    return {
        push: function (...linesToAdd) {
            lines.push(...linesToAdd.map(
                line => `${tab.repeat(indentLevel)}${line}`.trimRight()));
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
    lines.push(...text.split('\n').map(line => `// ${line}`.trimRight()))
}

function isObject(value) {
    // Good enough. Google "javascript check if object is object literal."
    return value !== null &&
        Object.prototype.toString.call(value) === '[object Object]';
}

function stringifyCall({function: func, arguments, rest}) {
    const funcStr = typeof func === 'string'
        ? stringifyExpression({symbol: func})
        : stringifyExpression(func); // it's a "dot," e.g. foo.bar.baz

    const argStrings = arguments.map(stringifyExpression);
    if (rest !== undefined) {
        argStrings.push(`${stringifyExpression(rest)}...`);
    }

    return `${funcStr}(${argStrings.join(', ')})`;
}

function stringifyExpression(expression) {
    // TODO: Need to determine when to parenthesize expressions. Right now the
    // code doesn't bother, except for the "not" operator ("!"). An alternative
    // is to put parentheses almost everywhere, but yuck. For now this renderer
    // can produce Go code that does not reflect the AST, due to lack of
    // parentheses. Keep that in mind.
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
        return stringifyCall(expression.call);
    }
    else if (expression.sequenceLiteral) {
        const type = expression.sequenceLiteral.type || '';
        const elements = expression.sequenceLiteral.elements;
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
    else if (expression.and) {
        const {left, right} = expression.and;
        return [left, right].map(stringifyExpression).join(' && ');
    }
    else if (expression.not) {
        const argument = expression.not;
        // We might need to put parentheses around `argument`; it depends.
        // Let's be conservative and say that symbols, calls, and primitives
        // are fine, but everything else needs parentheses.
        if (!isObject(argument) || argument.symbol || argument.call) {
            return `!${stringifyExpression(argument)}`;
        }
        else {
            return `!(${stringifyExpression(argument)})`;
        }
    }
    else if (expression.index) {
        let {object, index} = expression.index;
        if (typeof object !== 'string') {
            object = stringifyExpression(object);
        }
        return `${object}[${stringifyExpression(index)}]`;
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

function stringifyParameter({name, type}) {
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
    // we can reuse the "foo type" as rendered for function parameters.
    const parameter = stringifyParameter({name, type});
    if (value === undefined) {
        lines.push(`var ${parameter}`);
    }
    else {
        // This reminds me that we assume that an "expression" doesn't span
        // multiple lines. In Go this isn't true; for example, an anonymous
        // `func` is an expression. However, for the purposes of this AST we
        // can assume that an expression renders to source code without any
        // newlines.
        lines.push(`var ${parameter} = ${stringifyExpression(value)}`);
    }
}

function stringifyAssign({left: leftVars, right: rightExprs}) {
    // The left-hand side is `or(dot, String)`. `String` is a shorthand for a
    // symbol, rather than a string literal. So, we can't just pass it to
    // `stringifyExpression`.
    const leftHandSide = leftVars.map(lvalue => {
        if (typeof lvalue === 'string') {
            return lvalue;
        }
        else {
            // It's a {dot: ...} or a {index: ...}
            return stringifyExpression(lvalue);
        }
    }).join(', ');

    const rightHandSide = rightExprs.map(stringifyExpression).join(', ');
    return `${leftHandSide} = ${rightHandSide}`;
}

function renderIf({condition: conditionExpr, body, elseBody}, lines) {
    lines.push(`if ${stringifyExpression(conditionExpr)} {`);
    body.forEach(statement =>
        renderStatement(statement, lines.indented()));

    if (elseBody === undefined) {
        lines.push('}');
        return;
    }

    lines.push('} else {');
    elseBody.forEach(statement =>
        renderStatement(statement, lines.indented()));
    lines.push('}');
}

function renderRangeFor({variables, sequence, body}, lines) {
    lines.push(`for ${variables.join(', ')} := range ${stringifyExpression(sequence)} {`);
    body.forEach(statement =>
        renderStatement(statement, lines.indented()));
    lines.push('}');
}

function renderConditionFor({condition, body}, lines) {
    lines.push(`for ${stringifyExpression(condition)} {`);
    body.forEach(statement =>
        renderStatement(statement, lines.indented()));
    lines.push('}');
}

function stringifyStatement(statement) {
    const lines = linePrinter();
    renderStatement(statement, lines);
    return lines.render();
}

function renderIterationFor({init, condition, post, body}, lines) {
    init = init === undefined ? '' : stringifyStatement(init);
    condition = condition === undefined ? '' : stringifyExpression(condition);
    post = post === undefined ? '' : stringifyStatement(post);

    lines.push(`for ${[init, condition, post].join('; ')} {`);
    body.forEach(statement =>
        renderStatement(statement, lines.indented()));
    lines.push('}');
}

function stringifyReturn(expressions) {
    if (expressions.length === 0) {
        return `return`;
    }
    else {
        return `return ${expressions.map(stringifyExpression).join(', ')}`;
    }
}

function renderDeferThunk(statements, lines) {
    lines.push('defer func() {');
    statements.forEach(
        statement => renderStatement(statement, lines.indented()));
    lines.push('}()');
}

function renderAssignFunc({left, parameters, results, body}, lines) {
    const leftHandSide = typeof left === 'string'
        ? left
        : stringifyExpression(left);

    const parameterList = `(${parameters.map(stringifyParameter).join(', ')})`;
    const resultTuple = stringifyResults(results);

    lines.push(`${leftHandSide} = func${parameterList} ${resultTuple}{`);

    body.forEach(statement => renderStatement(statement, lines.indented()));
    lines.push('}')
}

function renderStatement(statement, lines) {
    if (statement.assign) {
        lines.push(stringifyAssign(statement.assign));
    }
    else if (statement.assignFunc) {
        renderAssignFunc(statement.assignFunc, lines);
    }
    else if (statement.if) {
        renderIf(statement.if, lines);
    }
    else if (statement.rangeFor) {
        renderRangeFor(statement.rangeFor, lines);
    }
    else if (statement.conditionFor) {
        renderConditionFor(statement.conditionFor, lines);
    }
    else if (statement.iterationFor) {
        renderIterationFor(statement.iterationFor, lines);
    }
    else if (statement.return) {
        lines.push(stringifyReturn(statement.return));
    }
    else if (statement.spacer) {
        lines.push(...Array(statement.spacer).fill(''));
    }
    else if (statement.variable) {
        renderVariable(statement.variable, lines);
    }
    else if (statement.defer) {
        lines.push(`defer ${stringifyStatement(statement.defer)}`);
    }
    else if (statement.deferThunk) {
        renderDeferThunk(statement.deferThunk, lines);
    }
    else {
        lines.push(stringifyExpression(statement));
    }
}

function stringifyResults(results) {
    const resultStrings = results.map(stringifyParameter);

    if (results.length === 0) {
        return '';
    }
    // If there is more than one parameter, or if any parameter has a variable
    // name, then we need parentheses around the results. Otherwise we don't.
    else if (results.length > 1 || 'name' in results[0]) {
        return `(${resultStrings.join(', ')}) `; // +space
    }
    else {
        return resultStrings[0] + ' '; // +space
    }
}

function renderFunction(func, lines) {
    // See `ast.tisch.js` for the shapes of `parameters`, `variables`, etc.
    const {
        documentation,
        name,
        parameters,
        results,
        body: {
            variables,
            statements
        }
    } = func;

    if (documentation !== undefined) {
        renderDocumentation(documentation, lines);
    }

    // func $name($parameters) $results {
    //     $variables
    //     $statements
    // }
    const parameterList = `(${parameters.map(stringifyParameter).join(', ')})`;
    lines.push(`func ${name}${parameterList} ${stringifyResults(results)}{`);

    // Each variable gets a `var`, but additionally might have a `defer func() ...`.
    variables.forEach(variable => {
        renderVariable(variable, lines.indented());
        if ('defer' in variable) {
            renderDeferThunk(variable.defer, lines.indented());
        }
    });

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
