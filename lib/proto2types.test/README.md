`proto2types` tests
============
`proto2types` behaves as a function: `.proto` in, `.json` out.

Each `.proto` file in this directory is the input to a unit test. The `.proto`
in run through `proto2types`, and it will either produce a an array of types
or fail. If there's a corresponding `.tisch.js` file in this directory, then
the `.proto` is expected to be valid, and the resulting output is expected to
satisfy the `.tisch.js` schema. If there is no corresponding `.tisch.js` file,
then the `.proto` is expected to be invalid.

The test driver is [test.js](test.js), a node script that globs this directory
for `.proto` files and their corresponding `.tisch.js` files, and asserts
success or failure as appropriate.
