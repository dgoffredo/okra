CRUD Languages
=============
Each directory here contains the "backend" for CRUD operations in some
programming language.

Each directory must contain one module (but may contain others),
`generate.js`, that exports a function having the following signature:
```javascript
// Return a string of ____ source code that implements the CRUD operations
// indicated by the specified parameters:
// - `crud`: an object as produced by some SQL dialect's `types2crud` function
// - `types`: an array of Okra types
// - `options`: an object of proto file options (by file)
function generate({crud, types, options})  {
    ...
}
```
where `____` is a placeholder for the name of the relevant programming
language.

The values within the object passed to `generate` have the following shapes:
- `crud` adheres to [schemas/crud.tisch.js](../schemas/crud.tisch.js)
- `types` is an array of objects, each of which adheres to
  [schemas/type.tisch.js](../schemas/type.tisch.js).
- `options` is an object that maps `.proto` file paths to an object
  containing the JSON-ified package-level options within that file. For
  example, if `foo/bar.proto` contained the option
  `option go_package = "foobar"`, and if there were no other proto files, then
  `options` would be:
  ```json
  {
      "foo/bar.proto": {
          "goPackage": "foobar"
      }
  }
  ```