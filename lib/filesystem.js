// file system related functions that aren't in the standard `fs` module
//
// As of this writing, this module is used in unit tests only.
define(['child_process', 'fs'], function (child_process, fs) {
'use strict';

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

return {glob, exists};

});
