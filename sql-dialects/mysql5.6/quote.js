// Quote identifiers (e.g. table names) and strings for MySQL statements.
define([], function () {
'use strict';

function quoteName(text) {
    return '`' + text.replace(/`/g, '``') + '`';
}

function quoteString(text) {
    return "'" + text.replace(/'/g, "''") + "'";
}

return {
    quoteName,
    quoteString
};

});
