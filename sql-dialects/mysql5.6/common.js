// Functions shared by `dbdiff2sql.js` and `types2crud.js`
define([], function () {
'use strict';

function quote(quoteChar, text) {
    const q = quoteChar;
    return q + text.replace(q, q + q) + q;
}

function quoteName(text) {
    return quote('`', text);
}

function quoteString(text) {
    return quote("'", text);
}

return {
    quoteName,
    quoteString
};

});
