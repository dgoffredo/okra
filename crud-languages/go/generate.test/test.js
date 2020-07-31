#!/usr/bin/env node

'use strict';

// Patch node's "require" system to allow for "define"-based modules.
require('../../../dependencies/node-amd-loader/amd-loader');


const {proto2types} = require('../../../lib/proto2types');
const {types2tables} = require('../../../lib/types2tables');
const {types2crud} = require('../../../sql-dialects/mysql5.6/types2crud');
const {generate} = require('../generate');

// proto2types for boyscouts -> {types, options}
// types2tables to get legends -> {tables, legends}
// types2crud  -> {<type>: {<operation>: [<instruction>, ...]}}

const {types, options} = proto2types({
        protoFiles: [__dirname + '/scouts.proto'],
        // protoFiles: [__dirname + '/mini.proto'],
});

function print(what) {
    console.log(JSON.stringify(what, undefined, 4));
}

// print({types, options});

const {tables, legends} = types2tables(types);

// print({tables, legends});

// `types2crud` expects an object with the following shape:
//
//     {
//         [Any]: {
//             'type': schemas.type
//             'legend?': schemas.legend
//         },
//         ...etc
//     }
//
const crud = types2crud(
    Object.fromEntries(
        types.map(type => {
            const entry = {type};
            const legend = legends[type.name];
            if (legend !== undefined) {
                entry.legend = legend;
            }
            return [type.name, entry];
        })));

// print(crud);
console.error(JSON.stringify(types, undefined, 4));

const goFile = generate({crud, types, options});

console.log(goFile);
