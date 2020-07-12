#!/usr/bin/env node

// Patch node's "require" system to allow for "define"-based modules.
require('../../dependencies/node-amd-loader/amd-loader');

const fs = require('fs');
const path = require('path');
const process = require('process');
const vm = require('vm');
const {dbdiff} = require('../dbdiff');
const tisch = require('../../dependencies/tisch/tisch');
const {glob, exists} = require('../filesystem');

// First, some optional command line parsing.
const verbose = ['-v', '--verbose'].includes(process.argv[2]);

const inputs = glob(path.join(__dirname, '*.json.js')); // test inputs

inputs.forEach(inputPath => {
    const stem = path.basename(inputPath, '.json.js');
    const schemaPath = path.join(__dirname, stem + '.tisch.js');
    const input = vm.runInNewContext(
        fs.readFileSync(inputPath, {encoding: 'utf8'}));

    if (exists(schemaPath)) {
        assertResult(inputPath, input, schemaPath);
    }
    else {
        assertFailure(inputPath, input);
    }
})

// Getting here means that we didn't throw an exception, which means that no
// test failed.
console.log(`All ${inputs.length} tests passed.`);

function assertFailure(inputPath, input) {
    let result;
    try {
        result = dbdiff(input.tablesBefore, input.tablesAfter);
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

    throw Error(`Expected test ${inputPath} to fail, but it ` +
                `succeeded with the result: ${pretty(result)}`);
}

function assertResult(inputPath, input, schemaPath) {
    const validate = tisch.compileFile(schemaPath);
    let result;
    try {
        result = dbdiff(input.tablesBefore, input.tablesAfter);
    }
    catch (error) {
        console.error(`Test case ${inputPath} failed. An exception was thrown.`);
        throw error;
    }

    if (!validate(result)) {
        console.error(`Test case ${inputPath} was expected to produce output ` +
            `satisfying the schema ${schemaPath}, but it did not.`);
        throw Error(validate.errors.join('\n'));
    }
}

