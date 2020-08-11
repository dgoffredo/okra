Go
===
[generate.js](generate.js) exports `function generate`, as documented in
general for CRUD languages in the parent directory's
[readme file](../README.md).

This implementation works by first constructing an abstract syntax tree (AST)
of the code to be generated, and then renders (stringifies) the tree as Go
code.

The AST is described by the tisch schema [ast.tisch.js](ast.tisch.js). A tree is
stringified by the [render.js](render.js) module.

Pre-rendered (skipping the AST) portions of Go code are cataloged in the
[prerendered.js](prerendered.js) module.

