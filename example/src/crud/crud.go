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
	"google.golang.org/genproto/protobuf/field_mask"
	"strings"
)

// CreateBoyScout adds the specified message to the specified db, subject to the
// specified cancellation context ctx. Return nil on success, or return a
// non-nil value if an error occurs.
func CreateBoyScout(ctx context.Context, db *sql.DB, message *pb.BoyScout) (err error) {
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

	if fieldMaskLen(message.Mask) != 0 {
		parameters = nil
		for _, element := range message.Mask.Paths {
			parameters = append(parameters, message.Id, element)
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_mask`( `id`, `value`) values", "(?, ?)", fieldMaskLen(message.Mask)), parameters...)
		if err != nil {
			return
		}
	}

	err = transaction.Commit()
	return
}

// ReadBoyScout reads from the specified db into the specified message, where
// the ID of the message must be pre-populated by the caller. On success, the
// error returned will be nil. On error, the error returned will not be nil.
// The specified cancellation context ctx is forwarded wherever appropriate.
func ReadBoyScout(ctx context.Context, db *sql.DB, message *pb.BoyScout) (err error) {
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
		err = noRow()
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
	ok = rows.Next()

	for ; ok; ok = rows.Next() {
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
	ok = rows.Next()

	for ; ok; ok = rows.Next() {
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
	ok = rows.Next()

	for ; ok; ok = rows.Next() {
		var temp *date.Date
		err = rows.Scan(intoDate(&temp))
		if err != nil {
			return
		}
		message.CampingTrips = append(message.CampingTrips, temp)
	}

	rows, err = transaction.QueryContext(ctx, "select `value` from `boy_scout_mask` where `id` = ?;", message.Id)
	if err != nil {
		return
	}
	ok = rows.Next()

	for ; ok; ok = rows.Next() {
		var temp string
		err = rows.Scan(&temp)
		if err != nil {
			return
		}
		message.Mask = appendField(message.Mask, temp)
	}

	err = transaction.Commit()
	return
}

// UpdateBoyScout updates within the specified db the fields of the specified
// message that are indicated by the specified fieldMask, subject to
// specified cancellation context ctx. Each element of fieldMask is the
// name of a field in message whose value is to be used in the database
// update. If fieldMask is empty or nil, then update all fields from
// message. Return nil on success, or a non-nil error if an error occurs.
func UpdateBoyScout(ctx context.Context, db *sql.DB, message *pb.BoyScout, fieldMask []string) (err error) {
	var transaction *sql.Tx
	defer func() {
		if err != nil && transaction != nil {
			err = combineErrors(err, transaction.Rollback())
		}
	}()
	var parameters []interface{}
	var fieldMaskMap map[string]bool
	var included func(string) bool

	if len(fieldMask) == 0 {
		included = func(string) bool {
			return true
		}
	} else {
		fieldMaskMap = make(map[string]bool, len(fieldMask))
		for _, field := range fieldMask {
			fieldMaskMap[field] = true
		}
		included = func(field string) bool {
			return fieldMaskMap[field]
		}
	}

	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "update `boy_scout` set `full_name` = case when ? then ? else `full_name` end, `short_name` = case when ? then ? else `short_name` end, `birthdate` = case when ? then ? else `birthdate` end, `join_time` = case when ? then from_unixtime(cast(? / 1000000.0 as decimal(20, 6))) else `join_time` end, `country_code` = case when ? then ? else `country_code` end, `language_code` = case when ? then ? else `language_code` end, `pack_code` = case when ? then ? else `pack_code` end, `rank` = case when ? then ? else `rank` end, `iana_country_code` = case when ? then ? else `iana_country_code` end, `what_about_this` = case when ? then ? else `what_about_this` end where `id` = ?;", included("full_name"), message.FullName, included("short_name"), message.ShortName, included("birthdate"), fromDate(message.Birthdate), included("join_time"), fromTimestamp(message.JoinTime), included("country_code"), message.CountryCode, included("language_code"), message.LanguageCode, included("pack_code"), message.PackCode, included("rank"), message.Rank, included("IANA_country_code"), message.IANACountryCode, included("whatAboutThis"), message.WhatAboutThis, message.Id)
	if err != nil {
		return
	}

	if included("badges") {
		_, err = transaction.ExecContext(ctx, "delete from `boy_scout_badges` where `id` = ?;", message.Id)
		if err != nil {
			return
		}
	}

	if included("badges") && len(message.Badges) != 0 {
		parameters = nil
		for _, element := range message.Badges {
			parameters = append(parameters, message.Id, element)
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_badges`( `id`, `value`) values", "(?, ?)", len(message.Badges)), parameters...)
		if err != nil {
			return
		}
	}

	if included("favorite_songs") {
		_, err = transaction.ExecContext(ctx, "delete from `boy_scout_favorite_songs` where `id` = ?;", message.Id)
		if err != nil {
			return
		}
	}

	if included("favorite_songs") && len(message.FavoriteSongs) != 0 {
		parameters = nil
		for _, element := range message.FavoriteSongs {
			parameters = append(parameters, message.Id, element)
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_favorite_songs`( `id`, `value`) values", "(?, ?)", len(message.FavoriteSongs)), parameters...)
		if err != nil {
			return
		}
	}

	if included("camping_trips") {
		_, err = transaction.ExecContext(ctx, "delete from `boy_scout_camping_trips` where `id` = ?;", message.Id)
		if err != nil {
			return
		}
	}

	if included("camping_trips") && len(message.CampingTrips) != 0 {
		parameters = nil
		for _, element := range message.CampingTrips {
			parameters = append(parameters, message.Id, element)
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_camping_trips`( `id`, `value`) values", "(?, ?)", len(message.CampingTrips)), parameters...)
		if err != nil {
			return
		}
	}

	if included("mask") {
		_, err = transaction.ExecContext(ctx, "delete from `boy_scout_mask` where `id` = ?;", message.Id)
		if err != nil {
			return
		}
	}

	if included("mask") && fieldMaskLen(message.Mask) != 0 {
		parameters = nil
		for _, element := range message.Mask.Paths {
			parameters = append(parameters, message.Id, element)
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_mask`( `id`, `value`) values", "(?, ?)", fieldMaskLen(message.Mask)), parameters...)
		if err != nil {
			return
		}
	}

	err = transaction.Commit()
	return
}

// DeleteBoyScout deletes the message having the specified id from the specified
// db, subject to the specified cancellation context ctx. On success, the error
// returned will be nil. On error, the error returned will not be nil. It is
// not considered an error if there is no message having the specified id in
// the database; i.e. deletions are idempotent.
func DeleteBoyScout(ctx context.Context, db *sql.DB, id string) (err error) {
	var message pb.BoyScout
	var transaction *sql.Tx
	defer func() {
		if err != nil && transaction != nil {
			err = combineErrors(err, transaction.Rollback())
		}
	}()

	message.Id = id
	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout_badges` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout_favorite_songs` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout_camping_trips` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout_mask` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout` where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	err = transaction.Commit()
	return
}

// CreateGirlScout adds the specified message to the specified db, subject to the
// specified cancellation context ctx. Return nil on success, or return a
// non-nil value if an error occurs.
func CreateGirlScout(ctx context.Context, db *sql.DB, message *pb.GirlScout) (err error) {
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

// ReadGirlScout reads from the specified db into the specified message, where
// the ID of the message must be pre-populated by the caller. On success, the
// error returned will be nil. On error, the error returned will not be nil.
// The specified cancellation context ctx is forwarded wherever appropriate.
func ReadGirlScout(ctx context.Context, db *sql.DB, message *pb.GirlScout) (err error) {
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
		err = noRow()
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

// UpdateGirlScout updates within the specified db the fields of the specified
// message that are indicated by the specified fieldMask, subject to
// specified cancellation context ctx. Each element of fieldMask is the
// name of a field in message whose value is to be used in the database
// update. If fieldMask is empty or nil, then update all fields from
// message. Return nil on success, or a non-nil error if an error occurs.
func UpdateGirlScout(ctx context.Context, db *sql.DB, message *pb.GirlScout, fieldMask []string) (err error) {
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

	_, err = transaction.ExecContext(ctx, "update `girl_scout` set where `id` = ?;", message.Id)
	if err != nil {
		return
	}

	err = transaction.Commit()
	return
}

// DeleteGirlScout deletes the message having the specified id from the specified
// db, subject to the specified cancellation context ctx. On success, the error
// returned will be nil. On error, the error returned will not be nil. It is
// not considered an error if there is no message having the specified id in
// the database; i.e. deletions are idempotent.
func DeleteGirlScout(ctx context.Context, db *sql.DB, id string) (err error) {
	var message pb.GirlScout
	var transaction *sql.Tx
	defer func() {
		if err != nil && transaction != nil {
			err = combineErrors(err, transaction.Rollback())
		}
	}()

	message.Id = id
	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `girl_scout` where `id` = ?;", message.Id)
	if err != nil {
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

// fieldMaskLen returns the length of the slice of paths within the specified
// field mask, or returns zero if the mask is nil.
func fieldMaskLen(mask *field_mask.FieldMask) int {
	if mask == nil {
		return 0
	}

	return len(mask.Paths)
}

// NoRow is the error that occurs when a row is expected from SQL but none is
// available. This is "not found" for "read" operations.
type NoRow struct{}

// Error returns the error message associated with the NoRow error.
func (NoRow) Error() string {
	return "Unable to read row from database. There is no row."
}

func noRow() NoRow {
	return NoRow{}
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

// appendField adds the specified string to the end of the paths within the
// specified field mask and returns the field mask. If the field mask is nil,
// then a new field mask is first created.
func appendField(mask *field_mask.FieldMask, fieldName string) *field_mask.FieldMask {
	if mask == nil {
		mask = &field_mask.FieldMask{}
	}

	mask.Paths = append(mask.Paths, fieldName)
	return mask
}
