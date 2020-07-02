define(['../dependencies/tisch/tisch', 'path'], function (tisch, path) {
    // Return an object that maps schema names to validator functions, e.g.
    //
    //     {
    //         "crud": function (object) {
    //             /* does it satisfy the "crud" schema? */
    //         },
    //         "table: function (object) { /* ... */ }
    //         /* ... */
    //     }

    // The object returned by `compileFiles` has keys that are full paths to
    // tisch files, e.g. "/home/ksozer/schemas/foo.tisch.js". We want keys
    // that are just the name, e.g. "foo". In general there could be
    // collisions, but there won't be, so just consider that an error.
    const byPath = tisch.compileFiles(path.join(__dirname, '*.tisch.js'));
    const byName = {};

    Object.entries(byPath).forEach(([key, validator]) => {
        const name = path.basename(key, '.tisch.js');
        if (name in byName) {
            throw Error(`Name collision in schemas: ${name}`);
        }
        byName[name] = validator;
    });

    return byName;
});
