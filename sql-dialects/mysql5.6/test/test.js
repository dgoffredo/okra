#!/usr/bin/env node

'use strict';

// TODO: scratch scratch

// I'M SO TIRED OF WRITING THIS TESTING BOILERPLATE SCREW IT
// DOOT DOOT!

// Patch node's "require" system to allow for "define"-based modules.
require('../../../dependencies/node-amd-loader/amd-loader');

const {proto2types} = require('../../../lib/proto2types');
const {types2tables} = require('../../../lib/types2tables');
const {dbdiff} = require('../../../lib/dbdiff');
const {dbdiff2sql} = require('../dbdiff2sql');

const types = proto2types({
    protoFiles: [__dirname + '/enum-array-field.proto']
});
const tables = types2tables(types).tables;

const newTypes = proto2types({
    protoFiles: [__dirname + '/enum-array-field-2.proto']
});
const newTables = types2tables(newTypes).tables;

let sql;

if (true) {
    sql = dbdiff2sql({
        allTables: tables,
        newTables: tables,
        modifications: {}
    });
} else {
    sql = dbdiff2sql(dbdiff(tables, newTables));
}

console.log(sql);