// Package crud provides create/read/update/delete (CRUD) database operations
// for protobol buffer message types.
//
// This file is generated code. Please do not modify it by hand.

package crud

import (
	pb "boyscouts.com/type/scouts"
	"strings"
)

// CreateBoyScout adds the specified message to the specified db, subject to the
// specified cancellation context ctx. Return nil on success, or return a
// non-nil value if an error occurs.
func CreateBoyScout(ctx context.Context, db *sql.DB, message pb.BoyScout) (err error) {
	var transaction *sql.Tx

	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "insert into `boy_scout`( `id`, `full_name`, `short_name`, `country_code`, `language_code`, `pack_code`, `rank`) values (?, ?, ?, ?, ?, ?, ?);", message.Id, message.FullName, message.ShortName, message.CountryCode, message.LanguageCode, message.PackCode, message.Rank)
	if err != nil {
		err = combineErrors(err, transaction.Rollback())
		return
	}

	err = transaction.Commit()
	return
}

// CompositeError is an error type that contains zero or more error types.
type CompositeError []error

func (errs CompositeError) Error() string {
	if len(errs) == 0 {
		return ""
	}

	var builder strings.Builder
	i := 0
	builder.WriteString(errs[i].Error())

	for i++; i < len(errs); i++ {
		builder.WriteString("\n")
		builder.WriteString(errs[i].Error())
	}

	return builder.String()
}

func combineErrors(errs ...error) CompositeError {
	var filtered []error
	for _, err := range errs {
		if err != nil {
			filtered = append(filtered, err)
		}
	}

	return CompositeError(filtered)
}
