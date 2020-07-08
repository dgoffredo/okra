#!/usr/bin/env node

// Patch node's "require" system to allow for "define"-based modules.
require('../../dependencies/node-amd-loader/amd-loader');

const path = require('path');
const {proto2types} = require('../proto2types');
const tisch = require('../../dependencies/tisch/tisch');
const {glob, exists} = require('../filesystem');

// Here's how this test driver works:
// - Each *.proto file is an input.
// - If there's a corresponding *.tisch.js file, then the input is expected to
//   be valid, and the output is expected to match the schema.
// - If there's no corresponding *.tisch.js file, then the input is expected
//   to be invalid.
const protos = glob(path.join(__dirname, '*.proto'));

protos.forEach(proto => {
    const stem = path.basename(proto, '.proto');
    const schemaPath = path.join(__dirname, stem + '.tisch.js');
    if (exists(schemaPath)) {
        assertResult(proto, schemaPath);
    }
    else {
        assertFailure(proto);
    }
})

// Getting here means that we didn't throw an exception, which means that no
// test failed.
console.log(`All ${protos.length} tests passed.`);

function assertFailure(protoPath) {
    let result;
    try {
        result = proto2types({
            protoFiles: [protoPath]
        });
    }
    catch (e) {
        return; // failure is expected
    }

    throw Error(`Expected proto schema ${protoPath} to fail, but it ` +
                `succeeded with the result: ` +
                `${JSON.stringify(result, undefined, 4)}`);
}

function assertResult(protoPath, schemaPath) {
    const validate = tisch.compileFile(schemaPath);
    let result;
    try {
        result = proto2types({
            protoFiles: [protoPath]
        });
    }
    catch (error) {
        console.error(`Test case ${protoPath} failed. The .proto did not compile.`);
        throw error;
    }

    if (!validate(result)) {
        console.error(`Test case ${protoPath} failed. The output was not as expected.`);
        throw Error(validate.errors.join('\n'));
    }
}
