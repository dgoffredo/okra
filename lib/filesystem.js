// file system related functions that aren't in the standard `fs` module
//
// As of this writing, this module is used in unit tests only.
define(['child_process', 'fs', 'path'], function (child_process, fs, path) {
'use strict';

// Create a temporary directory and invoke the specified `callback` with the
// following object:
//
//     {
//         'dir': String, // path to temporary directory
//         'keep': function () { ... } // invoke to prevent deletion
//     }
//
// After `callback` returns, delete the temporary directory and its contents,
// unless the callback invoked the `keep` property of its argument.
function withTempDir(callback) {
    const dir = child_process.execSync('mktemp -d', {encoding: 'utf8'}).trimRight();
    let deleteOnReturn = true;
    const result = callback({
        dir,
        keep: function () { deleteOnReturn = false; }
    });

    if (deleteOnReturn) {
        // `fs.rmdir`'s "recursive removal is experimental," so I use `rm`.
        child_process.execSync(['rm', '-r', dir].join(' '), {encoding: 'utf8'});
    }

    return result;
}

// Return a string containing the `diff` between the the specified arguments,
// where each argument is an object containing one property: either `path`,
// containing the path to a file; or 'string', containing would-be file content.
function diff(expectedPathOrString, actualPathOrString) {
    return withTempDir(({dir}) => {
        let left;
        if (expectedPathOrString.path) {
            left = expectedPathOrString.path;
        }
        else {
            left = path.join(dir, 'left');
            fs.writeFileSync(left, expectedPathOrString.string);
        }

        let right;
        if (actualPathOrString.path) {
            right = actualPathOrString.path;
        }
        else {
            right = path.join(dir, 'right');
            fs.writeFileSync(right, actualPathOrString.string);
        }

        const args = ['--ignore-trailing-space', left, right];
        return child_process.spawnSync('diff', args, {encoding: 'utf8'}).stdout;
    });
}

// Escape any characters in the specified `text` that could be used for
// command injection when appearing as a globbable shell command argument.
// Note that quotes are escaped as well.
function sanitize(text) {
    return text.replace(/['";`|&#$(){}\\]|\s/g, char => '\\' + char);
}

// Return an array of path strings matching the specified shell glob
// `patterns`.
function glob(...patterns) {
    // `-1` means "one column," which puts each path on its own line.
    // `--directory` means "don't list a directory's contents, just its name."
    // The `while` loop is to unquote results that contain spaces, e.g.
    // if a matching file is called `foo bar`, `ls` will print `'foo bar'`,
    // but we want `foo bar`.
    const sanitizedPatterns = patterns.map(sanitize),
          command = [
              'ls', '--directory', '-1', ...sanitizedPatterns,
              '| while read line; do echo "$line"; done'
          ].join(' '), 
          options = {encoding: 'utf8'},
          output = child_process.execSync(command, options),
          lines = output.split('\n');

    // The `ls` output will end with a newline, so `lines` has an extra empty.
    lines.pop();
    return lines;
}

function exists(file) {
    // Note to the maintainer: If there's a typo or some other bug in the
    // "try" block, the catch-all might hide it. I got burned, watch out.
    try {
        fs.accessSync(file);
        return true;
    }
    catch (_) {
        return false;
    }
}

return {glob, exists, diff};

});
