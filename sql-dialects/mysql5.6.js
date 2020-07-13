// TODO

define(['../schemas/schemas'], function (schemas) {
'use strict';

// `{<table name>: table}` -> `[table, ...]` such that a table comes before any
// tables that reference it in a foreign key, i.e. you can execute `CREATE
// TABLE` statements in that order.
function topologicallySortedTables(tables) {
    const result = [];
    const visited = {}; // {<table name>: Boolean}
    
    // Use a post-order depth-first traversal.
    // Don't bother checking for cycles, but do keep track of already-visited
    // tables in order to avoid duplicated work.
    function visit(table) {
        if (visited[table.name]) {
            return; // already seen it
        }

        visited[table.name] = true;

        table.columns.forEach(column => {
            if (column.foreignKey) {
                visit(tables[column.foreignKey.table]);
            }
        });

        result.push(table);
    }

    Object.values(tables).forEach(visit);
    return result;
}

// Return a string containing MySQL 5.6 SQL statements that migrate a database
// in the manner described by the specified `dbdiff`. `dbdiff` satisfies the
// `dbdiff.tisch.js` schema.
function dbdiff2sql(dbdiff) {
    // keep 'em honest
    schemas.dbdiff.enforce(dbdiff);

    const createTables = topologicallySortedTables(dbdiff.newTables)
        .map(table2sql)
        .map(statement => statement + ';\n\n')
        .join('');

    // TODO: do other stuff, too
    return createTables;
}

// Return a string containing a MySQL 5.6 `CREATE TABLE` statement that creates
// the specified `table`, where `table` satisfies the `table.tisch.js` schema.
function table2sql(table) {
    const columnClauses = table.columns.map(column2tableClause);

    const keyClauses = [];
    if ('primaryKey' in table) {
        keyClauses.push(`primary key (${quoteName(table.primaryKey)})`);
    }

    // TODO: foreign key clauses

    const indexClauses = (table.indices || []).map(index2tableClause);

    const tableClauses = [...columnClauses, ...keyClauses, ...indexClauses];

    const tableOptions = ['engine = InnoDB'];
    if ('description' in table) {
        tableOptions.push(`comment = ${quoteString(table.description)}`);
    }

    return `create table ${quoteName(table.name)}(
    ${tableClauses.join(",\n    ")})
${tableOptions.join('\n')}`;
}

// TODO
function column2tableClause(column) {
    const parts = [
        quoteName(column.name),
        type2sql(column.type),
        column.nullable ? 'null' : 'not null'
    ];

    if ('description' in column) {
        parts.push('comment', quoteString(column.description));
    }

    return parts.join(' ');
}

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

function type2sql(type) {
    // See column type in `table.tisch.js` and builtin in `builtin.tisch.js`.
    return {
        'TYPE_DOUBLE': 'double',
        'TYPE_FLOAT': 'float',
        'TYPE_INT64': 'bigint',
        'TYPE_UINT64': 'bigint unsigned',
        'TYPE_INT32': 'int',
        'TYPE_UINT32': 'int unsigned',
        'TYPE_BOOL': 'bool',
        'TYPE_STRING': 'longtext',
        'TYPE_BYTES': 'longblob',
        '.google.protobuf.Timestamp': 'timestamp(6)',
        'name': 'varchar(255)'
    }[type];
}

// TODO
function index2tableClause(index) {
   return `index (${index.columns.map(quoteName).join(', ')})`;
}

return {dbdiff2sql};
});
