#!/usr/bin/env node

'use strict';

// Patch node's "require" system to allow for "define"-based modules.
require('../../../dependencies/node-amd-loader/amd-loader');

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {renderFile} = require('../render');
const {glob} = require('../../../lib/filesystem');

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
    // TODO: This is not yet a test.
    // I'll want to write a diff function, which I'll want a tempfile function
    // for...

    // TODO: This isn't a unit test yet, we just print things. It's still
    // test-like, though, in that we're testing whether an exception is thrown. So,
    // I comment out the log line below as not to spam the output of`bin/test`.
    // console.log(goSource);
});
