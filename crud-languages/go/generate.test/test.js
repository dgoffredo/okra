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
        // protoFiles :: [<.proto file path>, ...]
        // These are the the paths to the protobuf schema files to compile.
        protoFiles: [__dirname + '/scouts.proto'],

        // rootTypes :: [<type name>, ...]
        // `proto2types` processes all message and enum types by default. To
        // restrict the set of types that are converted into database tables,
        // add fully-qualified type names to `rootTypes`. The types
        // `rootTypes` and their descendents will be processed exclusively.
        // rootTypes,

        // protoIncludePaths :: [<path to directory>, ...]
        // These are the directories to search for depended-upon protobuf
        // schema files. The parent directories of the files in `protoFiles`
        // are automatically included.
        // protoIncludePaths = [],

        // idFields :: {<type name>: <field name of object ID>}
        // Message types eventually become tables whose primary key
        // corresponds to the "id" field of the message type. `idFields`
        // allows you to specify a different field instead (e.g. if there is no
        // "id" field). The type names must be fully qualified, e.g. type "Foo"
        // in package "lol.wut" is "lol.wut.Foo" or, equivalently (for this
        // purpose), ".lol.wut.Foo".
        // idFields = {}
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

const goFile = generate({crud, types, options});

console.log(goFile);
