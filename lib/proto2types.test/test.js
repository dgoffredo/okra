#!/usr/bin/env node

// Patch node's "require" system to allow for "define"-based modules.
require('../../dependencies/node-amd-loader/amd-loader');

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const {proto2types} = require('../proto2types');
const tisch = require('../../dependencies/tisch/tisch');

// `sanitize` and `glob` are copypasta from `tisch.js`.

// Escape any characters in the specified `text` that could be used for
// command injection when appearing as a globbable shell command argument.
// Note that quotes are escaped as well.
function sanitize(text) {
    return text.replace(/['";`|&#$(){}]|\s/g, char => '\\' + char);
}

// Return an array of path strings matching the specified shell glob
// `patterns`.
function glob(...patterns) {
    // `-1` means "one column," which puts each path on its own line.
    // `--directory` means "don't list a directory's contents, just its name."
    // The `while` loop is to unquote results that contain spaces, e.g.
    // if a matching file is called `foo bar`, `ls` will print `'foo bar'`,
    // but we want `foo bar`.
    const sanitizedPatterns = patterns.map(sanitize),
          command = [
              'ls', '--directory', '-1', ...sanitizedPatterns,
              '| while read line; do echo $line; done'
          ].join(' '), 
          options = {encoding: 'utf8'},
          output = child_process.execSync(command, options),
          lines = output.split('\n');

    // The `ls` output will end with a newline, so `lines` has an extra empty.
    lines.pop();
    return lines;
}

function exists(file) {
    try {
        fs.accessSync(file);
        return true;
    }
    catch (_) {
        return false;
    }
}

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
