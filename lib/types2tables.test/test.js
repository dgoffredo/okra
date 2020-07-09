#!/usr/bin/env node

// Patch node's "require" system to allow for "define"-based modules.
require('../../dependencies/node-amd-loader/amd-loader');

const fs = require('fs');
const path = require('path');
const process = require('process');
const vm = require('vm');
const {types2tables} = require('../types2tables');
const tisch = require('../../dependencies/tisch/tisch');
const {glob, exists} = require('../filesystem');

// Here's how this test driver works:
// - Each *.json.js file is an input (an array of type definitions).
// - If there's a corresponding *.tisch.js file, then the input is expected to
//   be valid, and the output is expected to match the schema.
// - If there's no corresponding *.tisch.js file, then the input is expected
//   to be invalid.

// First, some optional command line parsing.
const verbose = ['-v', '--verbose'].includes(process.argv[2]);

const typeArrayFiles = glob(path.join(__dirname, '*.json.js')); // test inputs

typeArrayFiles.forEach(inputPath => {
    const stem = path.basename(inputPath, '.json.js');
    const schemaPath = path.join(__dirname, stem + '.tisch.js');
    const types = vm.runInNewContext(
        fs.readFileSync(inputPath, {encoding: 'utf8'}));

    if (exists(schemaPath)) {
        assertResult(inputPath, types, schemaPath);
    }
    else {
        assertFailure(inputPath, types);
    }
})

// Getting here means that we didn't throw an exception, which means that no
// test failed.
console.log(`All ${typeArrayFiles.length} tests passed.`);

function assertFailure(typesPath, types) {
    let result;
    try {
        result = types2tables(types);
    }
    catch (error) {
        if (verbose) {
            console.log('enountered an expected failure: ' + error);
        }
        return; // failure is expected
    }

    function pretty(value) {
        return JSON.stringify(value, undefined, 4);
    }

    throw Error(`Expected test ${typesPath} to fail, but it ` +
                `succeeded with the result: ${pretty(result)}`);
}

function assertResult(typesPath, types, schemaPath) {
    const validate = tisch.compileFile(schemaPath);
    let result;
    try {
        result = types2tables(types);
    }
    catch (error) {
        console.error(`Test case ${typesPath} failed. An exception was thrown.`);
        throw error;
    }

    if (!validate(result)) {
        console.error(`Test case ${typesPath} was expected to produce output ` +
            `satisfying the schema ${schemaPath}, but it did not.`);
        throw Error(validate.errors.join('\n'));
    }
}

