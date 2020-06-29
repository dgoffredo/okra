'use strict';

// Patch node's "require" system to allow for "define"-based modules.
require('../node-amd-loader/amd-loader');

const {proto2types} = require('../lib/proto2types');

const types = proto2types({
    protoFiles: ['/home/david/src/okra/protojson/example/hello.proto'],
    rootTypes: ['Hello']
})

module.exports = {
    proto2types,
    types
};
