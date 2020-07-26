// DDL means "data definition language." "CREATE," "ALTER," etc.
//
// At first I wanted for all SQL DDL backends to tisch to be idempotent, i.e.
// table definitions in their entirety would be the input to a SQL generator,
// and the generator would then produce SQL that has side effects only if the
// referenced entities didn't exist or were different from the versions in the
// input, e.g. "create table if not exist" and "alter column if exists", etc.
// You could run the same SQL script twice and it would only have an effect the
// first time. Every version of the schema could be migrated from any past
// version (or from scratch) without having to know anything about the past
// version.
//
// I found, at least for some examples using MySQL, that if you alter a column
// without significantly changing it (e.g. modify a comment, expand a `varchar`
// column in such a way that it still fits in its current storage), the
// database reports "zero rows affected." This gave me hope for the "no diffs,
// just idempotent DDL" idea.
//
// That hope is now gone. For one thing, some "do this only if it hasn't been
// done already" operations in MySQL (but notably not in MariaDB) require
// stored procedure syntax, and accordingly require stored procedure execution
// permission (which is not a big deal, since a DBA would be running the DDL
// statements anyway -- but it's still additional friction). The more important
// disappointment is that there is no way to do a DDL "dry run." If even the
// smallest change to the proto schema generates SQL that could change
// _anything and everything_ in the database, you want to make sure that there
// isn't a bug in the code generator that caused the generated DDL to damage
// the database or cause undue disruption. Databases don't provide a way to
// check what the effect of a set of DDL statement would be without actually
// performing the side effects. You could copy the entire database, run the DDL
// on the copy, and check whether the reported magnitude of the changes matches
// your expectations. That's a lot of trouble.
//
// Instead, I do the more complicated thing and take a diff between two sets of
// table definitions: the "before" and the "after." Then generate only those
// DDL statements necessary to get from "before" to "after." The resulting
// statements are _not_ idempotent, and depend on the previous version of the
// schema.
define(['../schemas/schemas'], function (schemas) {
'use strict';

// Return the operations necessary to convert a database schema from one with
// the specified `tablesBefore` into one with the specified `tablesAfter`.
// Both `tablesBefore` and `tablesAfter` are objects of the form
// `{<table name>: table}`, where `table` satisfies `table.tisch.js`.
function dbdiff(tablesBefore, tablesAfter) {
    // Keep the caller honest.
    const checkInput = ([name, table]) => {
        schemas.table.enforce(table);
        if (name !== table.name) {
            throw Error(`Object key ${JSON.stringify(name)} does not match ` +
                `the .name of table: ${JSON.stringify(table, undefined, 4)}`);
        }
    };
    Object.entries(tablesBefore).forEach(checkInput);
    Object.entries(tablesAfter).forEach(checkInput);

    return schemas.dbdiff.enforce({
        // all of the tables in `tablesAfter` (there are no table drops)
        // {<table name>: <table>}
        'allTables': tablesAfter,

        // tables in `tablesAfter` that are not in `tablesBefore`.
        // {<table name>: <table>}
        'newTables':
            Object.fromEntries(
                Object.entries(tablesAfter).filter(
                    ([name]) => !(name in tablesBefore))),

        // changes to make to tables in `tablesBefore` to make them equal to
        // their versions in `tablesAfter`. If a table has not changed, then it
        // does not appear in "modifications".
        // {<table name>: <modifications>}
        'modifications':
            Object.fromEntries(
                Object.entries(tablesAfter).filter(
                    ([name]) => name in tablesBefore).map(
                        ([name, table]) =>
                            [name, diffTable(tablesBefore[name], table)]))
    });
}

function str(value) {
    return JSON.stringify(value, undefined, 4);
}

// Return an object describing the modifications that would need to be made to
// the specified `tableBefore` in order to make it equal to the specified
// `tableAfter`. See "modification" in `dbdiff.tisch.js` for more information.
function diffTable(tableBefore, tableAfter) {
    const {insertions, updates} = diffRows(tableBefore, tableAfter);
    const alterations = diffDefinition(tableBefore, tableAfter);

    return {
        alterations,
        insertions,
        updates
    };
}

// Return the index of the first place in the specified arrays where their
// corresponding elements are not equal to each other.
// If one array is a prefix of the other, then return the length of the shorter
// array (or the length of either if they're the same length).
function indexOfFirstMismatch(left, right) {
    const length = Math.min(left.length, right.length);
    return (function loop(i) {
        if (i < length && left[i] === right[i]) {
            return loop(i + 1);
        }
        else {
            return i;
        }
    }(0));
}

// Return an array of alterations to make to the specified `tableBefore` so
// that its definition (columns, documentation) matches the specified
// `tableAfter`. An alteration satisfies the `alteration.tisch.js` schema.
function diffDefinition(tableBefore, tableAfter) {
    // There are three kinds of alterations:
    // - altered table description
    // - added column(s)
    // - altered columns
    //
    // Look for each, and for any that applies, add an "alteration" to `alterations`.
    const alterations = []; // the return value

    // Look for changed description (table COMMENT).
    if (tableAfter.description !== tableBefore.description) {
        const description = tableAfter.description === undefined
            ? '' 
            : tableAfter.description;

        alterations.push({
            kind: 'alterDescription',
            description
        });
    }

    // Look for added columns.
    const beforeNumColumns = tableBefore.columns.length;
    const afterNumColumns = tableAfter.columns.length;
    if (afterNumColumns < beforeNumColumns) {
        throw Error(`The "after" version of this table has fewer columns than ` +
            `the "before." Columns before: ${tableBefore.columns} Columns `+
            `after: ${tableAfter.columns}`);
    }

    const beforeColumnNames = tableBefore.columns.map(column => column.name);
    const afterColumnNames = tableAfter.columns.map(column => column.name);
    const mismatchIndex = indexOfFirstMismatch(beforeColumnNames, afterColumnNames);

    if (mismatchIndex === afterNumColumns) {
        // No columns were added.
    }
    else if (mismatchIndex === beforeNumColumns) {
        // Columns were added.
        alterations.push(...tableAfter.columns.slice(mismatchIndex).map(column => {
            const alteration = {
                kind: 'appendColumn',
                name: column.name,
                type: column.type
            };

            if (!column.nullable) {
                throw Error(`Added columns must be nullable. Error occurred ` +
                    `in column ${str(column.name)} of table: ` +
                    str(tableAfter));
            }

            ['foreignKey', 'description'].forEach(property => {
                if (property in column) {
                    alteration[property] = column[property];
                }
            });

            return alteration;
        }));
    }
    else {
        throw Error(`Table has invalid modifications. Columns cannot `+
            `be removed, and new columns must be added at the end. ` +
            `Error occurred at column offset ${mismatchIndex}. table before: `+
            `${str(tableBefore)} table after: ` +
            str(tableAfter));
    }

    // Look for modified columns.
    tableAfter.columns.slice(0, mismatchIndex).forEach((column, i) => {
        const beforeColumn = tableBefore.columns[i];

        // Same as the "after" column, except no need to mention foreign key.
        const alteration = {
            kind: 'alterColumn',
            ...column
        };
        delete alteration.foreignKey;

        const isAltered = ['type', 'description'].some(
            property => column[property] !== beforeColumn[property]);

        if (isAltered) {
            alterations.push(alteration);
        }
    });

    return alterations;
}

// Return an object `{insertions: [...], updates: [...]}` of additions to and
// modifications of the rows of the specified `tableBefore` necessary to make
// it resemble the specified `tableAfter`. 
function diffRows(tableBefore, tableAfter) {
    const primaryKeyColumnIndex = tableBefore.columns.findIndex(
        column => column.name === tableBefore.primaryKey);

    function numRows(table) {
        // Let the absence of rows be the same thing as zero rows.
        if ('rows' in table) {
            return table.rows.length;
        }
        else {
            return 0;
        }
    }

    // Some tables don't have a primary key (array field tables). In that case,
    // the table definitions must also have no rows.
    if (primaryKeyColumnIndex === -1) {
        if (numRows(tableBefore) !== 0 || numRows(tableAfter) !== 0) {
            throw Error(`Table ${str(tableBefore.name)} has no ` +
                `primary key, but its definition has rows.`);
        }

        return {insertions: [], updates: []};
    }

    const beforeColumnNames = tableBefore.columns.map(column => column.name);
    const beforeNumColumns = beforeColumnNames.length;
    const beforeByPrimary = (tableBefore.rows || []).reduce((result, row) => {
        result[row[primaryKeyColumnIndex]] = row;
        return result;
    }, {});
    const insertions = [];
    const updates = [];

    (tableAfter.rows || []).forEach(row => {
        const key = row[primaryKeyColumnIndex];
        const beforeRow = beforeByPrimary[key];
        if (beforeRow === undefined) {
            insertions.push(row)
            return;
        }
        
        // The row existed before. Check whether anything has changed.
        // `update` will get added to `updates` if it ends up containing anything.
        const update = {
            primaryKeyValue: key,
            columnValues: {}
        };

        // The `.slice` is to ignore any columns that have been added to
        // `tableAfter`.
        row.slice(0, beforeNumColumns).forEach((value, i) => {
            if (value !== beforeRow[i]) {
                update.columnValues[beforeColumnNames[i]] = value;
            }
        });

        if (Object.keys(update.columnValues).length !== 0) {
            updates.push(update);
        }
    });

    return {insertions, updates};
}

return {dbdiff};

});
