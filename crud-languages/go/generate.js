// This module provides a function, `generate`, that takes:
// - an object as produced by some SQL dialect's `types2crud` function,
// - an array of Okra types, and
// - an object of proto file options (by file)
//
// and returns a string containing Go source code for a module that implements
// the CRUD operations.
define([
    './render',
    '../../dependencies/tisch/tisch',
    '../../schemas/schemas'],
    function ({renderFile}, tisch, schemas) {
'use strict';

// Return a string containing Go source code for a module that implements
// the CRUD operations indicated by the specified arguments:
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

return {generate};

});
