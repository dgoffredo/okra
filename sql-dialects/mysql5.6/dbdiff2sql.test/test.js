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
const {types2crud} = require('../types2crud'); // TODO

const {types} = proto2types({
    protoFiles: [__dirname + '/enum-array-field.proto']
});
const {tables, legends} = types2tables(types);

function pretty(value) {
    return JSON.stringify(value, undefined, 4);
}

// TODO: hack hack
console.log(
    pretty(
        types2crud(
            Object.fromEntries(
                types.map(type => [
                    type.name,
                    // ugh
                    {type, ...(type.name in legends? {legend: legends[type.name]} : {})}
                ])))));

const newTypes = proto2types({
    protoFiles: [__dirname + '/enum-array-field-2.proto']
}).types;
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
