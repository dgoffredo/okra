define(['child_process', 'path'], function (child_process, path) {
'use strict';

// Return a list of objects satisfying `schemas/type.tisch.js` derived from
// running the protocol buffer compiler (`protoc`) in the specified manner. See
// the comments at the beginning of this function for documentation of the
// properties of `options`.
function proto2types(options) {
    const {
        // protoFiles :: [<.proto file path>, ...]
        // These are the the paths to the protobuf schema files to compile.
        protoFiles,

        // rootTypes :: [<type name>, ...]
        // `proto2types` processes all message and enum types by default. To
        // restrict the set of types that are converted into database tables,
        // add fully-qualified type names to `rootTypes`. The types
        // `rootTypes` and their descendents will be processed exclusively.
        rootTypes,

        // protoIncludePaths :: [<path to directory>, ...]
        // These are the directories to search for depended-upon protobuf
        // schema files. The parent directories of the files in `protoFiles`
        // are automatically included.
        protoIncludePaths = [],

        // primaryKeys :: {<type name>: <field name of primary key>}
        // Message types become tables whose primary key corresponds to the
        // "id" field of the message type. `primaryKeys` allows you to specify
        // a different field instead (e.g. if there is no "id" field). The type
        // names must be fully qualified, e.g. type "Foo" in package "lol.wut"
        // is "lol.wut.Foo" or equivalently (for this purpose) ".lol.wut.Foo".
        primaryKeys = {}
    } = options;

    if (protoFiles === undefined) {
        throw Error('Specify one or more .proto files to compile.');
    }

    // Execute the protoc compiler wrapper as a subprocess. It produces a JSON
    // object.
    const protoInfo = invokeProtocJson(protoIncludePaths, protoFiles);

    // TODO: Do I require type names to be fully qualified? Everywhere?

    // TODO actually do something with it.
    // console.log(JSON.stringify(protoInfo, undefined, 4));
    return protoInfo;
}

function invokeProtocJson(protoIncludePaths, protoFiles) {
    protoIncludePaths = Array.from(protoIncludePaths); // might modify it

    // `protoc` sometimes gets cranky if the .proto files aren't in directories
    // included in the proto paths. I say _sometimes_, because _sometimes_ it
    // doesn't complain. I don't understand. To make it work, add the parent
    // directory for each .proto file.
    protoFiles.forEach(file => protoIncludePaths.push(path.dirname(file)));

    const includeArgs = protoIncludePaths.map(path => `--proto_path=${path}`);

    const compilerPath =
        path.normalize(
            path.join(
                __dirname, '..', 'dependencies', 'protojson', 'tool.py'));

    const args = [...includeArgs, ...protoFiles];

    const options = {
        encoding: 'utf8',
        // Let `stderr` pass through to our `stderr`, because I couldn't get
        // node to capture the output on error with "pipe". I don't know why.
        stdio: ['ignore', 'pipe', 'inherit']
    };

    const result = child_process.spawnSync(compilerPath, args, options);

    if (result.status !== 0) {
        // "protoc terminated with status 1", or
        // "protoc terminated with signal 11"
        const what = result.status === null ? 'signal' : 'status';
        const value = result.status === null ? result.signal : result.status;
        throw Error(`protoc terminated with ${what} ${value}`);
    }

    return JSON.parse(result.stdout);
}

return {proto2types};

});
