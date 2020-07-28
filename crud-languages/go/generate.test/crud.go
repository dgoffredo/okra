// Package crud provides create/read/update/delete (CRUD) database operations
// for protobol buffer message types.
//
// This file is generated code. Please do not modify it by hand.

package crud

import (
	pb "boyscouts.com/type/scouts"
	"database/sql/driver"
	"fmt"
	"github.com/golang/protobuf/ptypes/timestamp"
	"google.golang.org/genproto/googleapis/type/date"
	"strings"
)

// CreateBoyScout adds the specified message to the specified db subject to the
// specified cancellation context ctx. Return nil on success, or return a
// non-nil value if an error occurs.
func CreateBoyScout(ctx context.Context, db *sql.DB, message pb.BoyScout) (err error) {
	var transaction *sql.Tx
	var parameters []interface{}

	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		return
	}
	
	_, err = transaction.ExecContext(ctx, "insert into `boy_scout`( `id`, `full_name`, `short_name`, `birthdate`, `join_time`, `country_code`, `language_code`, `pack_code`, `rank`, `iana_country_code`, `what_about_this`) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);", message.Id, message.FullName, message.ShortName, fromDate(message.Birthdate), fromTimestamp(message.JoinTime), message.CountryCode, message.LanguageCode, message.PackCode, message.Rank, message.IANACountryCode, message.WhatAboutThis)
	if err != nil {
		err = combineErrors(err, transaction.Rollback())
		return
	}
	
	if len(message.Badges) != 0 {
		parameters = nil
		for _, element := range message.Badges {
			parameters = append(parameters, message.Id, element)
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_badges`( `id`, `value`) values", "(?, ?)", len(message.Badges)), parameters...)
		if err != nil {
			err = combineErrors(err, transaction.Rollback())
			return
		}
	}
	
	if len(message.FavoriteSongs) != 0 {
		parameters = nil
		for _, element := range message.FavoriteSongs {
			parameters = append(parameters, message.Id, element)
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_favorite_songs`( `id`, `value`) values", "(?, ?)", len(message.FavoriteSongs)), parameters...)
		if err != nil {
			err = combineErrors(err, transaction.Rollback())
			return
		}
	}
	
	if len(message.CampingTrips) != 0 {
		parameters = nil
		for _, element := range message.CampingTrips {
			parameters = append(parameters, message.Id, element)
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_camping_trips`( `id`, `value`) values", "(?, ?)", len(message.CampingTrips)), parameters...)
		if err != nil {
			err = combineErrors(err, transaction.Rollback())
			return
		}
	}
	
	err = transaction.Commit()
	return
}

// dateValuer is a driver.Valuer that produces a string representation of a
// date.Date.
type dateValuer struct {
	source *date.Date
}

func (valuer dateValuer) Value() (driver.Value, error) {
	if valuer.source == nil {
		return nil, nil
	}

	d := valuer.source // for brevity
	dateString := fmt.Sprintf("%04d-%02d-%02d", d.Year, d.Month, d.Day)
	return driver.Value(dateString), nil
}

// fromDate is a constructor for dateValuer. It's redundant but I like the
// naming convention.
func fromDate(source *date.Date) dateValuer {
	return dateValuer{source}
}

// timestampValuer is a driver.Valuer that produces a numeric representation of a
// timestamp.Timestamp (number of microseconds since the unix epoch).
type timestampValuer struct {
	source *timestamp.Timestamp
}

func (valuer timestampValuer) Value() (driver.Value, error) {
    if valuer.source == nil {
		return nil, nil
	}

	ts := *valuer.source
	var microsecondsSinceEpoch int64 =
		ts.Seconds * 1_000_000 + int64(ts.Nanos) / 1000

	return driver.Value(microsecondsSinceEpoch), nil
}

// fromTimstamp is a constructor for timestampValuer. It's redundant but I like
// the naming convention.
func fromTimestamp(source *timestamp.Timestamp) timestampValuer {
	return timestampValuer{source}
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

// withTuples returns a string consisting of the specified sqlStatement
// followed by the specified numTuples copies of the specified sqlTuple
// separated by commas and spaces. numTuples must be greater than zero.
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
}
