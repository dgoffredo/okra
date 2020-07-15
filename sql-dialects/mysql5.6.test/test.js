#!/usr/bin/env node

'use strict';

// TODO: scratch scratch

// Patch node's "require" system to allow for "define"-based modules.
require('../../dependencies/node-amd-loader/amd-loader');

const {proto2types} = require('../../lib/proto2types');
const {types2tables} = require('../../lib/types2tables');
const {dbdiff} = require('../../lib/dbdiff');
const {dbdiff2sql} = require('../mysql5.6');

const types = proto2types({
    protoFiles: [__dirname + '/../../lib/proto2types.test/enum-array-field.proto']
    // protoFiles: [__dirname + '/../../lib/proto2types.test/id-field.proto']
});

const tables = types2tables(types).tables;
const newTables = JSON.parse(JSON.stringify(tables));

newTables.hotdog.rows[1][2] = 'FUCK';
newTables.grill.columns.push({
    name: 'newbie',
    type: 'TYPE_STRING',
    nullable: true, // TODO: enforce (do I already?)
    description: "BOOM I added a column!"
});

const sql = dbdiff2sql(dbdiff(tables, newTables));

console.log(sql);
