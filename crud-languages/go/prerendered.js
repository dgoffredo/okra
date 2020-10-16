define([], function () {

// Some parts of the generated Go code do not change based on the input, but
// are conditionally included in the output based on what's in the input.
//
// For example, if no protobuf type in the input has a timestamp-valued field,
// then the code for marshaling timestamps does not need to be included. If
// there _are_ timestamp-valued fields in the input, then several
// timestamp-related chunks of Go code must be included in the output, but can
// be included verbatim.
//
// Each optionally included section is associated with an identifier (as of
// this writing, always a function name) that, if used by the generated code,
// requires the chunks of pre-rendered code to be included in the output. The
// chunks of code are always file-level declarations, such as functions, types,
// vars, and constants. In addition to the chunks of code, each optionally
// included section is associated with a list of imports that must be included
// for the chunks of code to be valid.
//
// The shape of `prerenderedDeclarations` is:
//
//     {
//         <identifier used by generated code>: {
//             'imports': {<package>: or(<alias>, null)},
//             'declarations': [
//                 <declaration as defined in ast.tisch.js>,
//                 ...etc
//             ]
//         }
//     }
//
// The Go code is indented using tab characters, while this javascript code is
// indented using four space characters. Please use tabs for the Go code and
// spaces for the javascript code.
const prerenderedDeclarations = {
    // When a timestamp is an output parameter in SQL, such as when reading
    // (getting) a message that has a timestamp field, `intoTimestamp` wraps
    // the conversion from the okra representation (microseconds since Unix
    // epoch) into the protobuf representation (google.protobuf.Timestamp).
    intoTimestamp: {
        imports: {
            "database/sql": null,
            "github.com/golang/protobuf/ptypes/timestamp": null,
        },
        declarations: [
            {raw:
`type timestampScanner struct {
	destination  **timestamp.Timestamp
	intermediary sql.NullInt64 // microseconds since unix epoch
}`
            },
            {raw:
`func (scanner timestampScanner) Scan(value interface{}) error {
	err := scanner.intermediary.Scan(value)
	if err != nil {
		return err
	}

	if !scanner.intermediary.Valid {
		// "not valid" means null, which means nil
		*scanner.destination = nil
	} else {
		microsecondsSinceEpoch := scanner.intermediary.Int64
		*scanner.destination = &timestamp.Timestamp{
			Seconds: microsecondsSinceEpoch / 1_000_000,
			Nanos:   int32(microsecondsSinceEpoch%1_000_000) * 1000}
	}

	return nil
}`
            },
            {raw:
`// intoTimestamp is a constructor for timestampScanner.
func intoTimestamp(destination **timestamp.Timestamp) timestampScanner {
	return timestampScanner{destination: destination}
}`
            }
        ]
    },

    // When a date is an output parameter in SQL, such as when reading
    // (getting) a message that contains a date field, `intoDate` wraps the
    // conversion from the okra representation of the date (a string formatted
    // as "YYYY-MM-DD") to the protobuf representation (google.type.Date).
    intoDate: {
        imports: {
            "database/sql": null,
            "fmt": null,
            "google.golang.org/genproto/googleapis/type/date": null
        },
        declarations: [
            {raw:
`type dateScanner struct {
	destination  **date.Date
	intermediary sql.NullString // YYYY-MM-DD
}`
            },
            {raw:
`func (scanner dateScanner) Scan(value interface{}) error {
	err := scanner.intermediary.Scan(value)
	if err != nil {
		return err
	}

	if !scanner.intermediary.Valid {
		// "not valid" means null, which means nil
		*scanner.destination = nil
	} else {
		dateString := scanner.intermediary.String
		var result date.Date

		n, err := fmt.Sscanf(dateString, "%d-%d-%d", &result.Year, &result.Month, &result.Day)
		if err != nil {
			return err
		}
		if n != 3 {
			return fmt.Errorf(
				"Failed to sscanf a date. Expected 3 fields but parsed only %d in string %s",
				n,
				dateString)
		}

		*scanner.destination = &result
	}

	return nil
}`
            },
            {raw:
`// intoDate is a constructor for dateScanner.
func intoDate(destination **date.Date) dateScanner {
	return dateScanner{destination: destination}
}`
            }
        ]
    },

    // When a timestamp is an input parameter in SQL, such as when updating a
    // message that has a timestamp field, `fromTimestamp` wraps the conversion
    // from the protobuf representation (google.protobuf.Timestamp) to the okra
    // representation (microseconds since Unix epoch).
    fromTimestamp: {
        imports: {
            "database/sql/driver": null,
            "github.com/golang/protobuf/ptypes/timestamp": null
        },
        declarations: [
            {raw:
`// timestampValuer is a driver.Valuer that produces a numeric representation of a
// timestamp.Timestamp (number of microseconds since the unix epoch).
type timestampValuer struct {
	source *timestamp.Timestamp
}`
            },
            {raw:
`func (valuer timestampValuer) Value() (driver.Value, error) {
	if valuer.source == nil {
		return nil, nil
	}

	ts := *valuer.source
	var microsecondsSinceEpoch int64 = ts.Seconds*1_000_000 + int64(ts.Nanos)/1000

	return driver.Value(microsecondsSinceEpoch), nil
}`
            },
            {raw:
`// fromTimstamp is a constructor for timestampValuer.
func fromTimestamp(source *timestamp.Timestamp) timestampValuer {
	return timestampValuer{source: source}
}`
            }
        ]
    },

    // When a date is an input parameter in SQL, such as when updating a
    // message that has a date field, `fromDate` wraps the conversion from the
    // protobuf representation (google.type.Date) to the okra representation
    // (a string formatted as "YYYY-MM-DD").
    fromDate: {
        imports: {
            "database/sql/driver": null,
            "fmt": null,
            "google.golang.org/genproto/googleapis/type/date": null
        },
        declarations: [
            {raw:
`// dateValuer is a driver.Valuer that produces a string representation of a
// date.Date.
type dateValuer struct {
	source *date.Date
}`
            },
            {raw:
`func (valuer dateValuer) Value() (driver.Value, error) {
	if valuer.source == nil {
		return nil, nil
	}

	d := valuer.source // for brevity
	dateString := fmt.Sprintf("%04d-%02d-%02d", d.Year, d.Month, d.Day)
	return driver.Value(dateString), nil
}`
            },
            {raw:
`// fromDate is a constructor for dateValuer.
func fromDate(source *date.Date) dateValuer {
	return dateValuer{source: source}
}`
            }
        ]
    },

    // If a query fails, we return the error. But first, we have to rollback
    // the transaction. But _that_ can fail. So, if both the query and the
    // rollback fail, we combine the two errors into one and return the
    // resulting `CompositeError`. The generated code creates a
    // `CompositeError` by calling the `combineErrors` function.
    combineErrors: {
        imports: {
            'strings': null
        },
        declarations: [
            {raw:
`// CompositeError is an error type that contains zero or more error types.
type CompositeError []error`},
            {raw:
`func (errs CompositeError) Error() string {
	if len(errs) == 0 {
		return ""
	}

	var builder strings.Builder
	i := 0
	builder.WriteString(errs[i].Error())

	for i++; i < len(errs); i++ {
		builder.WriteString("\\n")
		builder.WriteString(errs[i].Error())
	}

	return builder.String()
}`
            },
            {raw:
`func combineErrors(errs ...error) CompositeError {
	var filtered []error
	for _, err := range errs {
		if err != nil {
			filtered = append(filtered, err)
		}
	}

	return CompositeError(filtered)
}`
            }
        ]
    },

    withTuples: {
        imports: {
            'strings': null
        },
        declarations: [
            {raw:
`// withTuples returns a string consisting of the specified sqlStatement
// followed by the specified numTuples copies of the specified sqlTuple
// separated by commas and spaces. numTuples must be greater than zero.
//
// For example, the following invocation:
//
//     withTuples("insert into foobar(x, y) values", "(?, ?)", 3)
//
// returns the following string:
//
//     "insert into foobar(x, y) values(?, ?), (?, ?), (?, ?)"
//
func withTuples(sqlStatement string, sqlTuple string, numTuples int) string {
	if numTuples < 1 {
		panic(fmt.Sprintf("withTuples requires at least one tuple, but %d were specified",
			numTuples))
	}

	var builder strings.Builder
	builder.WriteString(sqlStatement)
	i := 0
	builder.WriteString(sqlTuple)
	for i++; i < numTuples; i++ {
		builder.WriteString(", ")
		builder.WriteString(sqlTuple)
	}

	return builder.String()
}`
            }
        ]
    },

    // A `field_mask.FieldMask` is treated as if it were a slice of strings,
    // but it's not a slice of strings. It's a `struct` containing a single
    // field that is a slice of strings. `fieldMaskLen` and `appendField` are
    // like `len` and `append`, respectively, but deal with `FieldMask`
    // objects rather than with `[]string` directly.
    fieldMaskLen: {
        imports: {
            "google.golang.org/genproto/protobuf/field_mask": null
        },
        declarations: [
            {raw:
`// fieldMaskLen returns the length of the slice of paths within the specified
// field mask, or returns zero if the mask is nil.
func fieldMaskLen(mask *field_mask.FieldMask) int {
	if mask == nil {
		return 0
	}

	return len(mask.Paths)
}`
            }
        ]
    },
    appendField: {
        imports: {
            "google.golang.org/genproto/protobuf/field_mask": null
        },
        declarations: [
            {raw:
`// appendField adds the specified string to the end of the paths within the
// specified field mask and returns the field mask. If the field mask is nil,
// then a new field mask is first created.
func appendField(mask *field_mask.FieldMask, fieldName string) *field_mask.FieldMask {
	if mask == nil {
		mask = &field_mask.FieldMask{}
	}

	mask.Paths = append(mask.Paths, fieldName)
	return mask
}`
            }
        ]
    },
    // It is helpful to distinguish "not found" errors from other kinds of
    // errors. The `noRow` function returns an instance of an error type,
    // `NoRow` that users can identify using a type switch.
    noRow: {
        imports: {
            "fmt": null
        },
        declarations: [
            {raw: 
`// NoRow is the error that occurs when a row is expected from SQL but none is
// available. This is "not found" for "read" operations.
type NoRow struct{}`
            },
            {raw:
`// Error returns the error message associated with the NoRow error.
func (NoRow) Error() string {
	return "There is no corresponding row in the database."
}`
            },
            // It's silly to have a function that just returns `NoRow{}`, but we
            // currently identify prerendered code snippets my the mentioning
            // of certain functions (in this case, `noRow`). Rather than extend
            // that idenfication to consider struct literals, we define this
            // redundant function.
            {raw:
`func noRow() NoRow {
	return NoRow{}
}`
            }
        ]
    },
    // `ignore()` is used to ignore results from SQL. In particular, it's used
    // as part of the "are there any rows to update?" check done at the
    // beginning of "update" CRUD operations.
    ignore: {
        imports: {},
        declarations: [
            {raw:
`// ignore returns an output parameter for use in sql.Rows.Scan. The returned
// value accepts any SQL value and does nothing with it.
func ignore() interface{} {
	var dummy interface{}
	var pointer interface{} = &dummy
	return pointer
}`
            }
        ]
    },
    // `intoUint64` has a special implementation, because there is no
    // sql.NullUint64. You can pass a **uint64 to Rows.Scan, but then you need
    // code after Scan returns to inspect the resulting *uint64. Instead, here
    // I define a Scanner that scans into a sql.NullString and then parses a
    // uint64 from the string. I don't know if this is portable. It works for
    // the MySQL driver that currently interests me.
    intoUint64: {
        imports: {
            "database/sql": null,
            "strconv": null
        },
        declarations: [
            {raw:
`type uint64Scanner struct {
	destination  *uint64
	intermediary sql.NullString
}`
            },
            {raw:
`func (scanner uint64Scanner) Scan(value interface{}) error {
	if err := scanner.intermediary.Scan(value); err != nil {
		return err
	}

	if !scanner.intermediary.Valid {
		// !Valid -> null -> zero
		*scanner.destination = 0
		return nil
	}

	// parse a base-10 64-bit unsigned integer
	parsedValue, err := strconv.ParseUint(scanner.intermediary.String, 10, 64)
	if err != nil {
		return err
	}

	*scanner.destination = parsedValue
	return nil
}`
            },
            {raw:
`// intoUint64 is a constructor for uint64Scanner.
func intoUint64(destination *uint64) uint64Scanner {
	return uint64Scanner{destination: destination}
}`,
            }
        ]
    },
    // Note that there is no `fromUint64`, because `uint64` is not a valid
    // `driver.Value` type.

    // intoBytes is trivial: the sql package's default behavior does the right
    // thing for `[]byte`. I define a wrapper function, even though one is not
    // necessary, for consistency with the other types.
    intoBytes: {
        imports: {},
        declarations: [
            {raw:
`// intoBytes returns its argument. This function is provided for
// consistency with other output parameter types.
func intoBytes(destination *[]byte) *[]byte {
	return destination
}`
            }
        ]
    },
    // fromBytes is special, because in order to determine the nullness of a
    // `[]byte`, we have to use the `len` function.
    fromBytes: {
        imports: {
            "database/sql/driver": null,
        },
        declarations: [
            {raw:
`// bytesValuer is a driver.Valuer that produces []byte
type bytesValuer struct {
	source []byte
}`
            },
            {raw:
`func (valuer bytesValuer) Value() (driver.Value, error) {
	if len(valuer.source) == 0 {
		return nil, nil
	}

	return valuer.source, nil
}`
            },
            {raw:
`// fromBytes is a constructor for bytesValuer.
func fromBytes(source []byte) bytesValuer {
	return bytesValuer{source: source}
}`
            }
        ]
    },
    // intoEnum is special because there can be many enum types, each of which
    // is just an int32. Rather than have a separate Scanner for each enum
    // type, I define one that uses int32 and a function that assigns to the
    // correct enum type. This way, the per-enum type information is
    // encapsulated in a trivial anonymous function at the call site, e.g.
    //
    //     rows.Scan(intoEnum(func(value int32) {message.FavoriteColor = Color(value) })
    //
    intoEnum: {
        imports: {
            'database/sql': null
        },
        declarations: [
            {raw:
`type enumScanner struct {
	// flush assigns the specified int32 to the destination enum field.
	// The idea is that enumScanner doesn't know about the underlying
	// enum type. That information is encapsulated within flush.
	flush        func(int32)
	intermediary sql.NullInt64
}`
            },
            {raw:
`func (scanner enumScanner) Scan(value interface{}) error {
	if err := scanner.intermediary.Scan(value); err != nil {
		return err
	}

	var intValue int32
	if scanner.intermediary.Valid {
		intValue = int32(scanner.intermediary.Int64)
	}
	scanner.flush(intValue)
	return nil
}`
            },
            {raw:
`// intoEnum is a constructor for enumScanner.
func intoEnum(flush func(int32)) enumScanner {
	return enumScanner{flush: flush}
}`
            }
        ]
    }
};

// The following input/output parameter handling types/functions are so
// similar, they can be generated together: float64, float32,
// int64, int32, uint32, bool, and string. The other types are handled
// specially above.
// The following code registers the following Go functions: fromFloat64,
// intoFloat64, fromFloat32, intoFloat32, fromInt64, intoInt64, fromInt32,
// intoInt32, fromUint32, intoUint32, fromBool, intoBool, fromString, and
// intoString.
Object.entries({
    // Each entry has the following structure:
    //
    //     <Go type name>: {
    //         nullType: <Go sql null wrapper type>,
    //         valueType: <Go type for inserting into database>,
    //         zeroValue: <Go zero value>
    //     }
    //
    float64: {nullType: 'sql.NullFloat64', valueType: 'float64', zeroValue: '0'},
    float32: {nullType: 'sql.NullFloat64', valueType: 'float64', zeroValue: '0'},
    int64: {nullType: 'sql.NullInt64', valueType: 'int64', zeroValue: '0'},
    int32: {nullType: 'sql.NullInt64', valueType: 'int64', zeroValue: '0'},
    uint32: {nullType: 'sql.NullInt64', valueType: 'int64', zeroValue: '0'},
    // bool is strange: Go false -> SQL null, because false value cannot be
    // distinguished from field absence. It's the same as with the numeric
    // types, but is more conspicuous with bool because it has only two values.
    bool: {nullType: 'sql.NullBool', valueType: 'bool', zeroValue: 'false'},
    string: {nullType: 'sql.NullString', valueType: 'string', zeroValue: '""'}
}).forEach(([type, {nullType, valueType, zeroValue}]) => {
    // There are two functions associated with each type: `from____` and
    // `into____`. Each of those two functions has associated with it a helper
    // type (a Valuer or a Scanner, respectively), and each of those helper
    // types has a method (Value() or Scan(), respectively).

    // e.g. "bool" ->"Bool"
    const typeTitle = type[0].toUpperCase() + type.slice(1);

    // e.g. "fromBool"
    prerenderedDeclarations[`from${typeTitle}`] = {
        imports: {
            "database/sql/driver": null,
        },
        declarations: [
            {raw:
`// ${type}Valuer is a driver.Valuer that produces ${type}
type ${type}Valuer struct {
	source ${type}
}`
            },
            {raw:
`func (valuer ${type}Valuer) Value() (driver.Value, error) {
	if valuer.source == ${zeroValue} {
		return nil, nil
	}

	return ${valueType}(valuer.source), nil
}`
            },
            {raw:
`// from${typeTitle} is a constructor for ${type}Valuer.
func from${typeTitle}(source ${type}) ${type}Valuer {
	return ${type}Valuer{source: source}
}`
            }
        ]
    };

    // sql.NullInt64, for example, contains two fields: Valid bool and Int64
    // int64. `valueField` is the name of the int64 field, i.e. "Int64". We
    // need this to access the scanned value.
    // e.g. "sql.NullInt64" -> "Int64"
    const valueField = nullType.slice('sql.Null'.length);

    // e.g. "intoBool"
    prerenderedDeclarations[`into${typeTitle}`] = {
        imports: {
            "database/sql": null
        },
        declarations: [
            {raw:
`type ${type}Scanner struct {
	destination  *${type}
	intermediary ${nullType}
}`
            },
            {raw:
`func (scanner ${type}Scanner) Scan(value interface{}) error {
	err := scanner.intermediary.Scan(value)
	if err != nil {
		return err
	}

	if scanner.intermediary.Valid {
		*scanner.destination = ${type}(scanner.intermediary.${valueField})
	} else {
        *scanner.destination = ${zeroValue}
	}

	return nil
}`
            },
            {raw:
`// into${typeTitle} is a constructor for ${type}Scanner.
func into${typeTitle}(destination *${type}) ${type}Scanner {
	return ${type}Scanner{destination: destination}
}`
            }
        ]
    };
});

return prerenderedDeclarations;

});
