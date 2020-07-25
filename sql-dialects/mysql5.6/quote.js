// Quote identifiers (e.g. table names) and strings for MySQL statements.
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
