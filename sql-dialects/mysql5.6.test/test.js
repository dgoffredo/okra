#!/usr/bin/env node

'use strict';

// TODO: scratch scratch

// Patch node's "require" system to allow for "define"-based modules.
require('../../dependencies/node-amd-loader/amd-loader');

const {proto2types} = require('../../lib/proto2types');
const {types2tables} = require('../../lib/types2tables');
const {dbdiff2sql} = require('../mysql5.6');

const types = proto2types({
    // protoFiles: [__dirname + '/../../lib/proto2types.test/enum-array-field.proto']
    protoFiles: [__dirname + '/../../lib/proto2types.test/id-field.proto']
});

const tables = types2tables(types);

const sql = dbdiff2sql({
    allTables: tables.tables,
    newTables: tables.tables,
    modifications: {}
});

console.log(sql);
