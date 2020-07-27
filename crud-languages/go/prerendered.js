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
	 intermediary sql.NullInt64 // microseconds since unix epoch
	 destination **timestamp.Timestamp
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
			Nanos: int32(microsecondsSinceEpoch % 1_000_000) * 1000}
	}

	return nil
}`
            },
            {raw:
`// intoTimestamp is a constructor for timestampScanner. It is convenient to use
// directly as an argument to sql.Row.Scan.
func intoTimestamp(destination **timestamp.Timestamp) timestampScanner {
	var scanner timestampScanner
	scanner.destination = destination
	return scanner
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
	intermediary sql.NullString // YYYY-MM-DD
	destination **date.Date
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
`// intoDate is a constructor for dateScanner. It is convenient to use directly
// as an argument to sql.Row.Scan.
func intoDate(destination **date.Date) dateScanner {
	var scanner dateScanner
	scanner.destination = destination
	return scanner
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
`type timestampValuer struct {
	source *timestamp.Timestamp
}`
            },
            {raw:
`func (valuer timestampValuer) Value() (driver.Value, error) {
    if valuer.source == nil {
		return nil, nil
	}

	ts := *valuer.source
	var microsecondsSinceEpoch int64 =
		ts.Seconds * 1_000_000 + int64(ts.Nanos) / 1000

	return driver.Value(microsecondsSinceEpoch), nil
}`
            },
            {raw:
`// fromTimstamp is a constructor for timestampValuer. It's redundant but I like
// the naming convention.
func fromTimestamp(source *timestamp.Timestamp) timestampValuer {
	return timestampValuer{source}
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
`type dateValuer struct {
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
`// fromDate is a constructor for dateValuer. It's redundant but I like the
// naming convention.
func fromDate(source *date.Date) dateValuer {
	return dateValuer{source}
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
            {raw: `type CompositeError []error`},
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
    }
};

return prerenderedDeclarations;

});
