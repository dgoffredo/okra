`types2tables` tests
============
`types2tables` behaves as a function: `.json` in, `.json` out.

Each `.json.js` file in this directory is the input to a unit test. The file is
evaluated to produce an array of type definitions, and then is passed to the
`types2tables` function. If there's a corresponding `.tisch.js`, then the
input is expected to be valid and the output must satisfy the `.tisch.js`
schema. If there is no corresponding `.tisch.js`, then the input is expected
to be invalid.

`.json.js` files are used instead of plain `.json` so that the inputs can
contain comments that describe what is being tested, and in the case where
failure is expected, why it is expected to fail.

The test driver is [test.js](test.js), a node script that globs this directory
for `.json.js` files and their corresponding `.tisch.js` files, and asserts
success or failure as appropriate.
