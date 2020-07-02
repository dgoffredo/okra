'use strict';

// Patch node's "require" system to allow for "define"-based modules.
require('../dependencies/node-amd-loader/amd-loader');

const {proto2types} = require('../lib/proto2types');
const path = require('path');

const types = proto2types({
    protoFiles: [
        path.join(__dirname, '..', 'dependencies/protojson/example/hello.proto')
    ],
    rootTypes: ['sassafras.sassafras.Hello']
})

module.exports = {
    proto2types,
    types
};

console.log(JSON.stringify(types, undefined, 4));
