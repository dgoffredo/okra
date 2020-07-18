// TODO: document

define(['../../schemas/schemas'], function (schemas) {
'use strict';

// `{<table name>: table}` -> `[table, ...]` such that a table comes before any
// tables that reference it in a foreign key, i.e. you can execute `CREATE
// TABLE` statements in that order.
function topologicallySortedTables(tables) {
    const result = [];
    const visited = {}; // {<table name>: Boolean}
    
    // Use a post-order depth-first traversal.
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

// Return a SQL literal from the specified `value`.
function value2sql(value) {
    if (Array.isArray(value)) {
        return `(${value.map(value2sql).join(', ')})`;
    }
    if (typeof value === 'string') {
        return quoteString(value);
    }
    if (typeof value === 'number') {
        return value.toString();
    }
    if (value === null) {
        return 'null';
    }

    throw Error(`cannot convert value ${value} of type ${typeof value} to a SQL literal`);
}

// Return a string containing MySQL 5.6 SQL statements that migrate a database
// in the manner described by the specified `dbdiff`. `dbdiff` satisfies the
// `dbdiff.tisch.js` schema.
function dbdiff2sql(dbdiff) {
    // keep 'em honest
    schemas.dbdiff.enforce(dbdiff);

    // Order of statements returned:
    // - create new tables
    // - alter existing tables
    // - update existing rows
    // - insert new rows
    //
    // I use this order, rather than everything-per-table, so that the DDL
    // statements are together at the top, and the DML statements are together
    // at the bottom.

    const creates = topologicallySortedTables(dbdiff.newTables)
        .map(createTable);

    // Return an array of just the part of `dbdiff.modifications` indicated,
    // one element for each table. Exclude tables where `what` is empty.
    function justThe(what) {
        return Object.entries(dbdiff.modifications)
            .map(([tableName, modifications]) => [tableName, modifications[what]])
            .filter(([_, whats]) => whats.length);
    }

    const alterations = justThe('alterations')
        .map(([tableName, alterations]) => alterTable(tableName, alterations));

    const updates = justThe('updates')
        .map(([tableName, updates]) =>
            updates.map(update =>
                updateRow(dbdiff.allTables[tableName], update)))
        .flat(); // Each row updated gets its own statement.

    // `INSERT` comes from two places: "insertions" and "newTables" with
    // nonempty ".rows". Here is the latter, which is combined with the former
    // below.
    const newTablesWithRows = Object.entries(dbdiff.newTables)
        .filter(([name, table]) => (table.rows || []).length)
        .map(([name, table]) => [name, table.rows]);

    // This looks a tiny bit silly because we went from tables to table names
    // in `newTablesWithRows`, and now we're going back to tables, but that's
    // because `justThe` uses table names, so to keep things uniform here I
    // look up the tables by name in `allTables` again for the whole lot.
    const inserts = [...justThe('insertions'), ...newTablesWithRows]
        .map(([tableName, rows]) =>
            insertRows(dbdiff.allTables[tableName], rows));

    return [...creates, ...alterations, ...updates, ...inserts]
        .map(statement => statement + ';\n')
        .join('\n');
}

// Return a string containing a MySQL 5.6 `ALTER TABLE` statement
function alterTable(name, alterations) {
    // Loop through `alterations` a bunch of times, collecting a different part
    // of the `ALTER TABLE` statement each time.

    // There will be at most one comment change, but allow multiple.
    const commentChanges = alterations
       .filter(alt => alt.kind === 'alterDescription')
       .map(alt => `comment = ${quoteString(alt.description)}`);

    const modifyColumns = alterations
        .filter(alt => alt.kind === 'alterColumn')
        .map(({kind, ...column}) => 
            'modify column ' + column2tableClause(column));

    const addColumns = alterations
        .filter(alt => alt.kind === 'appendColumn')
        .map(({kind, ...column}) => 
            'add column ' + column2tableClause({nullable: true, ...column}));

    // Foreign keys happen as part of "appendColumn," but require a separate
    // SQL clause, so we do them separately here.
    const foreignKeys = alterations
        .filter(alt => alt.kind === 'appendColumn' && alt.foreignKey)
        .map(({kind, ...column}) =>
            'add ' + column2foreignKeyTableClause(column));

    const clauses = [
        ...commentChanges, ...modifyColumns, ...addColumns, ...foreignKeys
    ];

    return `alter table ${quoteName(name)}
${clauses.join(',\n')}`;
}

function updateRow(table, update) {
    const tableName = quoteName(table.name);
    // Tables whose rows we update will have a primary key.
    const keyColumnName = quoteName(table.primaryKey);
    const keyValue = value2sql(update.primaryKeyValue);
    const edits = Object.entries(update.columnValues).map(
        ([column, value]) => `set ${quoteName(column)} = ${value2sql(value)}`);

    return `update ${tableName}
${edits.join(' ')}
where ${keyColumnName} = ${keyValue}`;
}

function insertRows(table, rows) {
    const tableName = quoteName(table.name);
    const columns = table.columns.map(column => quoteName(column.name));
    const values = rows.map(value2sql);

    return `insert into ${tableName} (${columns.join(', ')}) values
${values.join(',\n')}`;
}

// Return a string containing a MySQL 5.6 `CREATE TABLE` statement that creates
// the specified `table`, where `table` satisfies the `table.tisch.js` schema.
function createTable(table) {
    const columnClauses = table.columns.map(column2tableClause);

    const keyClauses = [];
    if ('primaryKey' in table) {
        keyClauses.push(`primary key (${quoteName(table.primaryKey)})`);
    }

    keyClauses.push(...table.columns
        .filter(column => 'foreignKey' in column)
        .map(column2foreignKeyTableClause));

    const indexClauses = (table.indices || []).map(index2tableClause);

    const tableClauses = [...columnClauses, ...keyClauses, ...indexClauses];

    const tableOptions = [
        'engine = InnoDB',
        'character set utf8mb4'
    ];
    if ('description' in table) {
        tableOptions.push(`comment = ${quoteString(table.description)}`);
    }

    return `create table ${quoteName(table.name)}(
    ${tableClauses.join(",\n    ")})
${tableOptions.join('\n')}`;
}

// e.g. "foreign key (faith) references religion(id)"
function column2foreignKeyTableClause(column) {
    if (!('foreignKey' in column)) {
        throw Error(`column passed to column2foreignKeyTableClause must ` +
            `have a foreignKey property`);
    }

    const keyColumn = quoteName(column.name);
    const foreignTable = quoteName(column.foreignKey.table);
    const foreignColumn = quoteName(column.foreignKey.column);

    return `foreign key (${keyColumn}) references ${foreignTable}(${foreignColumn})`;
}

// e.g. "foo varchar(255) not null comment 'this is the foo'"
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

// e.g. "index (parent_id, child_id)"
function index2tableClause(index) {
   return `index (${index.columns.map(quoteName).join(', ')})`;
}

return {dbdiff2sql};
});
