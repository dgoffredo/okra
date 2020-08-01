// Package crud provides create/read/update/delete (CRUD) database operations
// for protobol buffer message types.
//
// This file is generated code. Please do not modify it by hand.

package crud

import (
	pb "boyscouts.com/type/scouts"
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"github.com/golang/protobuf/ptypes/timestamp"
	"google.golang.org/genproto/googleapis/type/date"
	"strings"
)

// CreateBoyScout adds the specified message to the specified db, subject to the
// specified cancellation context ctx. Return nil on success, or return a
// non-nil value if an error occurs.
func CreateBoyScout(ctx context.Context, db *sql.DB, message pb.BoyScout) (err error) {
	var transaction *sql.Tx
	defer func() {
		if err != nil && transaction != nil {
			err = combineErrors(err, transaction.Rollback())
		}
	}()
	var parameters []interface{}

	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "insert into `boy_scout`( `id`, `full_name`, `short_name`, `birthdate`, `join_time`, `country_code`, `language_code`, `pack_code`, `rank`, `iana_country_code`, `what_about_this`) values (?, ?, ?, ?, from_unixtime(cast(? / 1000000.0 as decimal(20, 6))), ?, ?, ?, ?, ?, ?);", message.Id, message.FullName, message.ShortName, fromDate(message.Birthdate), fromTimestamp(message.JoinTime), message.CountryCode, message.LanguageCode, message.PackCode, message.Rank, message.IANACountryCode, message.WhatAboutThis)
	if err != nil {
		return
	}

	if len(message.Badges) != 0 {
		parameters = nil
		for _, element := range message.Badges {
			parameters = append(parameters, message.Id, element)
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_badges`( `id`, `value`) values", "(?, ?)", len(message.Badges)), parameters...)
		if err != nil {
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
			return
		}
	}

	err = transaction.Commit()
	return
}

// ReadBoyScout reads the message having the specified id from the specified
// db, subject to the specified cancellation context ctx. On success, the
// error returned will be nil and the pb.BoyScout will not be nil. On
// error, the error returned will not be nil.
func ReadBoyScout(ctx context.Context, db *sql.DB, id string) (message *pb.BoyScout, err error) {
	var transaction *sql.Tx
	defer func() {
		if err != nil && transaction != nil {
			err = combineErrors(err, transaction.Rollback())
		}
	}()
	var rows *sql.Rows
	defer func() {
		if rows != nil {
			rows.Close()
		}
	}()
	var ok bool

	message = &pb.BoyScout{}
	message.Id = id
	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		return
	}

	rows, err = transaction.QueryContext(ctx, "select `id`, `full_name`, `short_name`, `birthdate`, floor(unix_timestamp(`join_time`) * 1000000), `country_code`, `language_code`, `pack_code`, `rank`, `iana_country_code`, `what_about_this` from `boy_scout` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	ok = rows.Next()
	if !ok {
		err = fmt.Errorf("Unable to read row from database. There is no row.")
		return
	}

	err = rows.Scan(&message.Id, &message.FullName, &message.ShortName, intoDate(&message.Birthdate), intoTimestamp(&message.JoinTime), &message.CountryCode, &message.LanguageCode, &message.PackCode, &message.Rank, &message.IANACountryCode, &message.WhatAboutThis)
	if err != nil {
		return
	}
	rows.Next()

	rows, err = transaction.QueryContext(ctx, "select `value` from `boy_scout_badges` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	for rows.Next() {
		var temp pb.Badge
		err = rows.Scan(&temp)
		if err != nil {
			return
		}
		message.Badges = append(message.Badges, temp)
	}

	rows, err = transaction.QueryContext(ctx, "select `value` from `boy_scout_favorite_songs` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	for rows.Next() {
		var temp string
		err = rows.Scan(&temp)
		if err != nil {
			return
		}
		message.FavoriteSongs = append(message.FavoriteSongs, temp)
	}

	rows, err = transaction.QueryContext(ctx, "select `value` from `boy_scout_camping_trips` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	for rows.Next() {
		var temp *date.Date
		err = rows.Scan(intoDate(&temp))
		if err != nil {
			return
		}
		message.CampingTrips = append(message.CampingTrips, temp)
	}

	err = transaction.Commit()
	return
}

// CreateGirlScout adds the specified message to the specified db, subject to the
// specified cancellation context ctx. Return nil on success, or return a
// non-nil value if an error occurs.
func CreateGirlScout(ctx context.Context, db *sql.DB, message pb.GirlScout) (err error) {
	var transaction *sql.Tx
	defer func() {
		if err != nil && transaction != nil {
			err = combineErrors(err, transaction.Rollback())
		}
	}()

	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "insert into `girl_scout`( `id`) values (?);", message.Id)
	if err != nil {
		return
	}

	err = transaction.Commit()
	return
}

// ReadGirlScout reads the message having the specified id from the specified
// db, subject to the specified cancellation context ctx. On success, the
// error returned will be nil and the pb.GirlScout will not be nil. On
// error, the error returned will not be nil.
func ReadGirlScout(ctx context.Context, db *sql.DB, id string) (message *pb.GirlScout, err error) {
	var transaction *sql.Tx
	defer func() {
		if err != nil && transaction != nil {
			err = combineErrors(err, transaction.Rollback())
		}
	}()
	var rows *sql.Rows
	defer func() {
		if rows != nil {
			rows.Close()
		}
	}()
	var ok bool

	message = &pb.GirlScout{}
	message.Id = id
	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		return
	}

	rows, err = transaction.QueryContext(ctx, "select `id` from `girl_scout` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	ok = rows.Next()
	if !ok {
		err = fmt.Errorf("Unable to read row from database. There is no row.")
		return
	}

	err = rows.Scan(&message.Id)
	if err != nil {
		return
	}
	rows.Next()

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
	var microsecondsSinceEpoch int64 = ts.Seconds*1_000_000 + int64(ts.Nanos)/1000

	return driver.Value(microsecondsSinceEpoch), nil
}

// fromTimstamp is a constructor for timestampValuer. It's redundant but I like
// the naming convention.
func fromTimestamp(source *timestamp.Timestamp) timestampValuer {
	return timestampValuer{source}
}

// withTuples returns a string consisting of the specified sqlStatement
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
}

type dateScanner struct {
	intermediary sql.NullString // YYYY-MM-DD
	destination  **date.Date
}

func (scanner dateScanner) Scan(value interface{}) error {
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
}

// intoDate is a constructor for dateScanner. It is convenient to use directly
// as an argument to sql.Row.Scan.
func intoDate(destination **date.Date) dateScanner {
	var scanner dateScanner
	scanner.destination = destination
	return scanner
}

type timestampScanner struct {
	intermediary sql.NullInt64 // microseconds since unix epoch
	destination  **timestamp.Timestamp
}

func (scanner timestampScanner) Scan(value interface{}) error {
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
}

// intoTimestamp is a constructor for timestampScanner. It is convenient to use
// directly as an argument to sql.Row.Scan.
func intoTimestamp(destination **timestamp.Timestamp) timestampScanner {
	var scanner timestampScanner
	scanner.destination = destination
	return scanner
}
