// This module provides functions for breaking apart identifiers into "words"
// and recombining them according to a prescribed naming style, such as
// snake_case or CapitalCamelCase.
define([], function () {

// Return an array of the "words" in the specified string as determined by
// interpreting the string with various naming conventions, like:
//
// - "snake_case" → ["snake", "case"]
// - "camelCase" → ["camel", "Case"]
// - "camelCaseWithCAPS" → ["camel", "Case", "With", "CAPS"]
// - "CAPSFollowedByCamelCase" → ["CAPS", "Followed", "By", "Camel", "Case"]
// - "SHOUTING_CASE" → ["SHOUTING", "CASE"]
// - "names with spaces" → ["names", "with", "spaces"]
// - "hyphen-case" → ["hyphen", "case"]
// - "other;kinds::of--punctuation" → ["other", "kinds", "of", "punctuation"]
// - "ANYCrazy_COMBINATION::of . styles" →
//       ["ANY", "Crazy", "COMBINATION", "of", "styles"]
//
// The resulting array of strings contains the words with their original casing.
// Connecting characters, such as punctuation and whitespace, are omitted.
const split= (function() {
    // These patterns will be or'd together to make the full pattern.
    // Don't forget the "u" flag for "unicode" and the "g" flag for "global."
    const separators = [
        /(\s|\p{P})+/, // whitespace or punctuation
        /(?<=\p{Lu})(?=\p{Lu}\p{Ll})/, // THISCase (match has length zero)
        /(?<=\p{Ll})(?=\p{Lu})/ // thisCase (match has length zero)
    ];
    const pattern = separators.map(regex => regex.source).join('|');
    const separatorRegex = RegExp(pattern, 'gu');

    return function (text) {
        return text.split(separatorRegex).filter(part =>
            // Splitting on a zero-length separator (like the "virtual
            // character" between "O" and "B" in "FOOBar") yields `undefined`.
            // Splitting on whitespace/punctuation yields the matching
            // whitespace/punctutation. Omit both cases.
            part !== undefined && !part.match(separatorRegex));
    };
}());

function normalize(name, namingStyle) {
    const styles = {
        'snake_case': words =>
            words.map(word => word.toLowerCase()).join('_'),
        'TitleCamelCase': words => {
            function capitalize(word) {
                return word.slice(0, 1).toUpperCase() + word.slice(1);
            }
            return words.map(capitalize).join('');
        }
    };

    const convert = styles[namingStyle];
    if (convert === undefined) {
        throw Error(`unexpected naming style ${JSON.stringify(namingStyle)}. ` +
            `Naming style must be one of the following: ` +
            JSON.stringify(Object.keys(styles)));
    }
    
    return convert(split(name));
}

return {normalize, split}

});
