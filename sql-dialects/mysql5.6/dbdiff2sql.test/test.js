#!/usr/bin/env node

'use strict';

// Patch node's "require" system to allow for "define"-based modules.
require('../../../dependencies/node-amd-loader/amd-loader');

const path = require('path');
const {glob, diff} = require('../../../lib/filesystem');
const {proto2types} = require('../../../lib/proto2types');
const {types2tables} = require('../../../lib/types2tables');
const {dbdiff} = require('../../../lib/dbdiff');
const {dbdiff2sql} = require('../dbdiff2sql');

// For each (*.before.proto, *.after.proto) pair, get the SQL for the resulting
// dbdiff, and compare it with *.sql, which is the expected output of dbdiff2sql.

const befores = glob(path.join(__dirname, '*.before.proto'));

befores.forEach(beforePath => {
    const stem = path.basename(beforePath, '.before.proto');
    const afterPath = path.join(__dirname, stem + '.after.proto');
    const sqlPath = path.join(__dirname, stem + '.sql');
    
    const {types} = proto2types({
        protoFiles: [beforePath]
    });
    const {tables} = types2tables(types);

    const newTypes = proto2types({
        protoFiles: [afterPath]
    }).types;
    const newTables = types2tables(newTypes).tables;

    const sql = dbdiff2sql(dbdiff(tables, newTables));
    const diffResult = diff({path: sqlPath}, {string: sql});
    if (diffResult.length !== 0) {
        throw Error(`Expected SQL ${sqlPath} and generated SQL differ:\n${diffResult}`);
    }
});

// If we got here, then nothing above threw, so we succeeded.
console.log(`All ${befores.length} tests passed.`);
