#!/usr/bin/env node

'use strict';

// Patch node's "require" system to allow for "define"-based modules.
require('../../../dependencies/node-amd-loader/amd-loader');

const path = require('path');
const {glob} = require('../../../lib/filesystem');
const {proto2types} = require('../../../lib/proto2types');
const {types2tables} = require('../../../lib/types2tables');
const {types2crud} = require('../types2crud');
const tisch = require('../../../dependencies/tisch/tisch');

// For each *.proto, calculate the CRUD operations JSON and compare it against
// the expected schema *.tisch.js.
const protos = glob(path.join(__dirname, '*.proto'));

protos.forEach(protoPath => {
    const {types} = proto2types({
        protoFiles: [protoPath]
    });

    const {legends} = types2tables(types);

    const crud = types2crud(
        Object.fromEntries(
            types.map(type => [
                type.name,
                // the type, but also the legend if there is one
                {type, ...(type.name in legends? {legend: legends[type.name]} : {})}
            ])));

    // `crud` is what we were calculating. Now compile the schema describing
    // the expected value, and compare `crud` against the expectation.
    const stem = path.basename(protoPath, '.proto');
    const schemaPath = path.join(__dirname, stem + '.tisch.js');

    tisch.compileFile(schemaPath).enforce(crud);
});

// If we got here, then nothing above threw, so we succeeded.
console.log(`All ${protos.length} tests passed.`);
