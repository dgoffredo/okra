// This module provides a function, `generate`, that takes:
// - an object as produced by some SQL dialect's `types2crud` function,
// - an array of Okra types, and
// - an object of proto file options (by file)
//
// and returns a string containing Go source code for a module that implements
// the CRUD operations.
define([
    './prerendered',
    './render',
    '../../dependencies/tisch/tisch',
    '../../schemas/schemas'],
    function (prerendered, {renderFile}, tisch, schemas) {
'use strict';

// Return a string of Go source code for a module that implements the CRUD
// operations indicated by the specified arguments:
// - `crud`: an object as produced by some SQL dialect's `types2crud` function
// - `types`: an array of Okra types
// - `options`: an object of proto file options (by file)
function generate({crud, types, options}) {
    // Verify that the arguments have the expected shape.
    schemas.crud.enforce(crud);
    types.forEach(schemas.type.enforce);
    tisch.compileFunction(({Any, etc}) => ({
        // file path -> FileOptions object from protocol buffer compiler
        [Any]: Object,
        ...etc
    })).enforce(options);

    const goFile = 'TODO';

    // TODO
    return renderFile(goFile);
}

// Special identifiers:
// - intoDate
// - intoTimestamp
// - fromDate
// - fromTimestamp

function isObject(value) {
    // Good enough. Google "javascript check if object is object literal."
    return value !== null &&
        Object.prototype.toString.call(value) === '[object Object]';
}

// Walk the specified `tree`, which is just a javascript value, invoking the
// specified `visitor` with each node. The traversal is depth-first pre-order
// (`visitor` is invoked on a node before the node's children are visited). `walk`
// returns `undefined`.
//
// For example,
//
//     const tree = [
//         {foo: 'hello'},
//         {bar: [1, 2, 3], baz: 7}
//     ];
//
//     let count = 0;
//     function visit(node) {
//         if (typeof node === number) {
//             ++count;
//         }
//     }
//
//     walk(tree, visit);
//
//     console.log(`encountered ${count} numbers`);
//
// prints "encountered 4 numbers".
//
// Note that the only values that are searched for children are arrays and
// object literals.
function walk(tree, visit) {
    function recur(tree) {
        visit(tree);

        if (Array.isArray(tree)) {
            tree.forEach(recur);
        }
        else if (isObject(tree)) {
            Object.values(tree).forEach(recur);
        }
    }

    recur(tree);
}

// Search through the specified `goFile` AST for references to pre-rendered
// functions. Add imports and toplevel declarations to `goFile` as necessary to
// satsify those references. Return `goFile`. Note that `goFile` is modified in
// place.
function includePrerendered(goFile) {
    const referenced = {}; // set of function names

    function visit(node) {
        // Here's a reminder about the shape of a "call" AST node:
        //
        //     {'call': {
        //         'function': or(String, dot),
        //         'arguments': [expression, ...etc]}}
        //
        if (isObject(node) &&
            'call' in node &&
            typeof node.call.function === 'string' &&
            node.call.function in prerendered) {
            referenced[node.call.function] = true;
        }
    }

    walk(goFile.declarations, visit);

    // Fill `goFile` with additional imports and declarations based on what was
    // `referenced`.
    Object.keys(referenced).forEach(name => {
        const {imports, declarations} = prerendered[name];

        // We could just do `goFile.imports.assign(imports)`, but let's catch
        // disagreements about the package alias, if any.
        Object.entries(imports).forEach(([package, alias]) => {
            if (package in goFile.imports && goFile.imports[package] !== alias) {
                throw Error(`There is a package alias name conflict for the ` +
                    `package ${package}. Error occurred while adding ` +
                    `pre-rendered code for ${name}.`);
            }

            goFile.imports[package] = alias;
        });

        // Add the declarations to the end of the file (anywhere would work).
        goFile.declarations.push(...declarations);
    });

    return goFile;
}

return {generate};

});
