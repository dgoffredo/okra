#!/usr/bin/env node

'use strict';

// Patch node's "require" system to allow for "define"-based modules.
require('../../../dependencies/node-amd-loader/amd-loader');

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {renderFile} = require('../render');
const {glob, diff} = require('../../../lib/filesystem');

// Here's how this test driver works:
// - Each *.json.js file is an input (JS representation of Go source file AST)
// - For each *.json.js file, there is a corresponding *.go file contaning the
//   expected output when the AST is rendered.
// - Make sure that the output of rendering the *.json.js is the same as the
//   content of the *.go.

const astPaths = glob(path.join(__dirname, '*.json.js')); // test inputs

astPaths.forEach(astPath => {
    const ast = vm.runInNewContext(
        fs.readFileSync(astPath, {encoding: 'utf8'}));

    const goSource = renderFile(ast);
    const stem = path.basename(astPath, '.json.js');
    const expectedPath = stem + '.go';

    const diffResult = diff({path: expectedPath}, {string: goSource});
    if (diffResult.length !== 0) {
        throw Error(`Expected Go ${expectedPath} and generated Go differ:\n${diffResult}`);
    }
});

// If we got here, then nothing above threw, so we succeeded.
console.log(`All ${astPaths.length} tests passed.`);
