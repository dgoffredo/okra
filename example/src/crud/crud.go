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
	"strconv"
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

	_, err = transaction.ExecContext(ctx, "insert into `boy_scout`( `id`, `full_name`, `short_name`, `birthdate`, `join_time`, `country_code`, `language_code`, `pack_code`, `rank`, `iana_country_code`, `what_about_this`, `big_unsigned_int`) values (?, ?, ?, ?, from_unixtime(cast(? / 1000000.0 as decimal(20, 6))), ?, ?, ?, ?, ?, ?, ?);", fromString(message.Id), fromString(message.FullName), fromString(message.ShortName), fromDate(message.Birthdate), fromTimestamp(message.JoinTime), fromString(message.CountryCode), fromString(message.LanguageCode), fromUint32(message.PackCode), fromInt32(int32(message.Rank)), fromString(message.IANACountryCode), fromInt64(message.WhatAboutThis), message.BigUnsignedInt)
	if err != nil {
		return
	}

	if len(message.Badges) != 0 {
		parameters = nil
		for i, element := range message.Badges {
			parameters = append(parameters, fromString(message.Id), i, fromInt32(int32(element)))
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_badges`( `id`, `ordinality`, `value`) values", "(?, ?, ?)", len(message.Badges)), parameters...)
		if err != nil {
			return
		}
	}

	if len(message.FavoriteSongs) != 0 {
		parameters = nil
		for i, element := range message.FavoriteSongs {
			parameters = append(parameters, fromString(message.Id), i, fromString(element))
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_favorite_songs`( `id`, `ordinality`, `value`) values", "(?, ?, ?)", len(message.FavoriteSongs)), parameters...)
		if err != nil {
			return
		}
	}

	if len(message.CampingTrips) != 0 {
		parameters = nil
		for i, element := range message.CampingTrips {
			parameters = append(parameters, fromString(message.Id), i, fromDate(element))
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_camping_trips`( `id`, `ordinality`, `value`) values", "(?, ?, ?)", len(message.CampingTrips)), parameters...)
		if err != nil {
			return
		}
	}

	if fieldMaskLen(message.Mask) != 0 {
		parameters = nil
		for i, element := range message.Mask.Paths {
			parameters = append(parameters, fromString(message.Id), i, fromString(element))
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_mask`( `id`, `ordinality`, `value`) values", "(?, ?, ?)", fieldMaskLen(message.Mask)), parameters...)
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

	rows, err = transaction.QueryContext(ctx, "select `id`, `full_name`, `short_name`, `birthdate`, floor(unix_timestamp(`join_time`) * 1000000), `country_code`, `language_code`, `pack_code`, `rank`, `iana_country_code`, `what_about_this`, `big_unsigned_int` from `boy_scout` where `id` = ?;", fromString(message.Id))
	if err != nil {
		return
	}
	ok = rows.Next()

	if !ok {
		err = noRow()
		return
	}

	err = rows.Scan(intoString(&message.Id), intoString(&message.FullName), intoString(&message.ShortName), intoDate(&message.Birthdate), intoTimestamp(&message.JoinTime), intoString(&message.CountryCode), intoString(&message.LanguageCode), intoUint32(&message.PackCode), intoEnum(func(value int32) { message.Rank = pb.Rank(value) }), intoString(&message.IANACountryCode), intoInt64(&message.WhatAboutThis), intoUint64(&message.BigUnsignedInt))
	if err != nil {
		return
	}
	rows.Next()

	rows, err = transaction.QueryContext(ctx, "select `value` from `boy_scout_badges` where `id` = ? order by `ordinality`;", fromString(message.Id))
	if err != nil {
		return
	}
	ok = rows.Next()

	for ; ok; ok = rows.Next() {
		var temp pb.Badge
		err = rows.Scan(intoEnum(func(value int32) { temp = pb.Badge(value) }))
		if err != nil {
			return
		}
		message.Badges = append(message.Badges, temp)
	}

	rows, err = transaction.QueryContext(ctx, "select `value` from `boy_scout_favorite_songs` where `id` = ? order by `ordinality`;", fromString(message.Id))
	if err != nil {
		return
	}
	ok = rows.Next()

	for ; ok; ok = rows.Next() {
		var temp string
		err = rows.Scan(intoString(&temp))
		if err != nil {
			return
		}
		message.FavoriteSongs = append(message.FavoriteSongs, temp)
	}

	rows, err = transaction.QueryContext(ctx, "select `value` from `boy_scout_camping_trips` where `id` = ? order by `ordinality`;", fromString(message.Id))
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

	rows, err = transaction.QueryContext(ctx, "select `value` from `boy_scout_mask` where `id` = ? order by `ordinality`;", fromString(message.Id))
	if err != nil {
		return
	}
	ok = rows.Next()

	for ; ok; ok = rows.Next() {
		var temp string
		err = rows.Scan(intoString(&temp))
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
	var rows *sql.Rows
	defer func() {
		if rows != nil {
			rows.Close()
		}
	}()
	var ok bool
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

	rows, err = transaction.QueryContext(ctx, "select null from `boy_scout` where `id` = ?;", fromString(message.Id))
	if err != nil {
		return
	}
	ok = rows.Next()

	if !ok {
		err = noRow()
		return
	}

	err = rows.Scan(ignore())
	if err != nil {
		return
	}
	rows.Next()

	_, err = transaction.ExecContext(ctx, "update `boy_scout` set `full_name` = case when ? then ? else `full_name` end, `short_name` = case when ? then ? else `short_name` end, `birthdate` = case when ? then ? else `birthdate` end, `join_time` = case when ? then from_unixtime(cast(? / 1000000.0 as decimal(20, 6))) else `join_time` end, `country_code` = case when ? then ? else `country_code` end, `language_code` = case when ? then ? else `language_code` end, `pack_code` = case when ? then ? else `pack_code` end, `rank` = case when ? then ? else `rank` end, `iana_country_code` = case when ? then ? else `iana_country_code` end, `what_about_this` = case when ? then ? else `what_about_this` end, `big_unsigned_int` = case when ? then ? else `big_unsigned_int` end where `id` = ?;", included("full_name"), fromString(message.FullName), included("short_name"), fromString(message.ShortName), included("birthdate"), fromDate(message.Birthdate), included("join_time"), fromTimestamp(message.JoinTime), included("country_code"), fromString(message.CountryCode), included("language_code"), fromString(message.LanguageCode), included("pack_code"), fromUint32(message.PackCode), included("rank"), fromInt32(int32(message.Rank)), included("IANA_country_code"), fromString(message.IANACountryCode), included("whatAboutThis"), fromInt64(message.WhatAboutThis), included("big_unsigned_int"), message.BigUnsignedInt, fromString(message.Id))
	if err != nil {
		return
	}

	if included("badges") {
		_, err = transaction.ExecContext(ctx, "delete from `boy_scout_badges` where `id` = ?;", fromString(message.Id))
		if err != nil {
			return
		}
	}

	if included("badges") && len(message.Badges) != 0 {
		parameters = nil
		for i, element := range message.Badges {
			parameters = append(parameters, fromString(message.Id), i, fromInt32(int32(element)))
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_badges`( `id`, `ordinality`, `value`) values", "(?, ?, ?)", len(message.Badges)), parameters...)
		if err != nil {
			return
		}
	}

	if included("favorite_songs") {
		_, err = transaction.ExecContext(ctx, "delete from `boy_scout_favorite_songs` where `id` = ?;", fromString(message.Id))
		if err != nil {
			return
		}
	}

	if included("favorite_songs") && len(message.FavoriteSongs) != 0 {
		parameters = nil
		for i, element := range message.FavoriteSongs {
			parameters = append(parameters, fromString(message.Id), i, fromString(element))
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_favorite_songs`( `id`, `ordinality`, `value`) values", "(?, ?, ?)", len(message.FavoriteSongs)), parameters...)
		if err != nil {
			return
		}
	}

	if included("camping_trips") {
		_, err = transaction.ExecContext(ctx, "delete from `boy_scout_camping_trips` where `id` = ?;", fromString(message.Id))
		if err != nil {
			return
		}
	}

	if included("camping_trips") && len(message.CampingTrips) != 0 {
		parameters = nil
		for i, element := range message.CampingTrips {
			parameters = append(parameters, fromString(message.Id), i, fromDate(element))
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_camping_trips`( `id`, `ordinality`, `value`) values", "(?, ?, ?)", len(message.CampingTrips)), parameters...)
		if err != nil {
			return
		}
	}

	if included("mask") {
		_, err = transaction.ExecContext(ctx, "delete from `boy_scout_mask` where `id` = ?;", fromString(message.Id))
		if err != nil {
			return
		}
	}

	if included("mask") && fieldMaskLen(message.Mask) != 0 {
		parameters = nil
		for i, element := range message.Mask.Paths {
			parameters = append(parameters, fromString(message.Id), i, fromString(element))
		}
		_, err = transaction.ExecContext(ctx, withTuples("insert into `boy_scout_mask`( `id`, `ordinality`, `value`) values", "(?, ?, ?)", fieldMaskLen(message.Mask)), parameters...)
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

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout_badges` where `id` = ?;", fromString(message.Id))
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout_favorite_songs` where `id` = ?;", fromString(message.Id))
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout_camping_trips` where `id` = ?;", fromString(message.Id))
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout_mask` where `id` = ?;", fromString(message.Id))
	if err != nil {
		return
	}

	_, err = transaction.ExecContext(ctx, "delete from `boy_scout` where `id` = ?;", fromString(message.Id))
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

	_, err = transaction.ExecContext(ctx, "insert into `girl_scout`( `id`) values (?);", fromString(message.Id))
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

	rows, err = transaction.QueryContext(ctx, "select `id` from `girl_scout` where `id` = ?;", fromString(message.Id))
	if err != nil {
		return
	}
	ok = rows.Next()

	if !ok {
		err = noRow()
		return
	}

	err = rows.Scan(intoString(&message.Id))
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

	rows, err = transaction.QueryContext(ctx, "select null from `girl_scout` where `id` = ?;", fromString(message.Id))
	if err != nil {
		return
	}
	ok = rows.Next()

	if !ok {
		err = noRow()
		return
	}

	err = rows.Scan(ignore())
	if err != nil {
		return
	}
	rows.Next()

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

	_, err = transaction.ExecContext(ctx, "delete from `girl_scout` where `id` = ?;", fromString(message.Id))
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

// stringValuer is a driver.Valuer that produces string
type stringValuer struct {
	source string
}

func (valuer stringValuer) Value() (driver.Value, error) {
	if valuer.source == "" {
		return nil, nil
	}

	return string(valuer.source), nil
}

// fromString is a constructor for stringValuer.
func fromString(source string) stringValuer {
	return stringValuer{source: source}
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

// fromDate is a constructor for dateValuer.
func fromDate(source *date.Date) dateValuer {
	return dateValuer{source: source}
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

// fromTimstamp is a constructor for timestampValuer.
func fromTimestamp(source *timestamp.Timestamp) timestampValuer {
	return timestampValuer{source: source}
}

// uint32Valuer is a driver.Valuer that produces uint32
type uint32Valuer struct {
	source uint32
}

func (valuer uint32Valuer) Value() (driver.Value, error) {
	if valuer.source == 0 {
		return nil, nil
	}

	return int64(valuer.source), nil
}

// fromUint32 is a constructor for uint32Valuer.
func fromUint32(source uint32) uint32Valuer {
	return uint32Valuer{source: source}
}

// int32Valuer is a driver.Valuer that produces int32
type int32Valuer struct {
	source int32
}

func (valuer int32Valuer) Value() (driver.Value, error) {
	if valuer.source == 0 {
		return nil, nil
	}

	return int64(valuer.source), nil
}

// fromInt32 is a constructor for int32Valuer.
func fromInt32(source int32) int32Valuer {
	return int32Valuer{source: source}
}

// int64Valuer is a driver.Valuer that produces int64
type int64Valuer struct {
	source int64
}

func (valuer int64Valuer) Value() (driver.Value, error) {
	if valuer.source == 0 {
		return nil, nil
	}

	return int64(valuer.source), nil
}

// fromInt64 is a constructor for int64Valuer.
func fromInt64(source int64) int64Valuer {
	return int64Valuer{source: source}
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
	return "There is no corresponding row in the database."
}

func noRow() NoRow {
	return NoRow{}
}

type stringScanner struct {
	destination  *string
	intermediary sql.NullString
}

func (scanner stringScanner) Scan(value interface{}) error {
	err := scanner.intermediary.Scan(value)
	if err != nil {
		return err
	}

	if scanner.intermediary.Valid {
		*scanner.destination = string(scanner.intermediary.String)
	} else {
		*scanner.destination = ""
	}

	return nil
}

// intoString is a constructor for stringScanner.
func intoString(destination *string) stringScanner {
	return stringScanner{destination: destination}
}

type dateScanner struct {
	destination  **date.Date
	intermediary sql.NullString // YYYY-MM-DD
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

// intoDate is a constructor for dateScanner.
func intoDate(destination **date.Date) dateScanner {
	return dateScanner{destination: destination}
}

type timestampScanner struct {
	destination  **timestamp.Timestamp
	intermediary sql.NullInt64 // microseconds since unix epoch
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

// intoTimestamp is a constructor for timestampScanner.
func intoTimestamp(destination **timestamp.Timestamp) timestampScanner {
	return timestampScanner{destination: destination}
}

type uint32Scanner struct {
	destination  *uint32
	intermediary sql.NullInt64
}

func (scanner uint32Scanner) Scan(value interface{}) error {
	err := scanner.intermediary.Scan(value)
	if err != nil {
		return err
	}

	if scanner.intermediary.Valid {
		*scanner.destination = uint32(scanner.intermediary.Int64)
	} else {
		*scanner.destination = 0
	}

	return nil
}

// intoUint32 is a constructor for uint32Scanner.
func intoUint32(destination *uint32) uint32Scanner {
	return uint32Scanner{destination: destination}
}

type enumScanner struct {
	// flush assigns the specified int32 to the destination enum field.
	// The idea is that enumScanner doesn't know about the underlying
	// enum type. That information is encapsulated within flush.
	flush        func(int32)
	intermediary sql.NullInt64
}

func (scanner enumScanner) Scan(value interface{}) error {
	if err := scanner.intermediary.Scan(value); err != nil {
		return err
	}

	var intValue int32
	if scanner.intermediary.Valid {
		intValue = int32(scanner.intermediary.Int64)
	}
	scanner.flush(intValue)
	return nil
}

// intoEnum is a constructor for enumScanner.
func intoEnum(flush func(int32)) enumScanner {
	return enumScanner{flush: flush}
}

type int64Scanner struct {
	destination  *int64
	intermediary sql.NullInt64
}

func (scanner int64Scanner) Scan(value interface{}) error {
	err := scanner.intermediary.Scan(value)
	if err != nil {
		return err
	}

	if scanner.intermediary.Valid {
		*scanner.destination = int64(scanner.intermediary.Int64)
	} else {
		*scanner.destination = 0
	}

	return nil
}

// intoInt64 is a constructor for int64Scanner.
func intoInt64(destination *int64) int64Scanner {
	return int64Scanner{destination: destination}
}

type uint64Scanner struct {
	destination  *uint64
	intermediary sql.NullString
}

func (scanner uint64Scanner) Scan(value interface{}) error {
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
}

// intoUint64 is a constructor for uint64Scanner.
func intoUint64(destination *uint64) uint64Scanner {
	return uint64Scanner{destination: destination}
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

// ignore returns an output parameter for use in sql.Rows.Scan. The returned
// value accepts any SQL value and does nothing with it.
func ignore() interface{} {
	var dummy interface{}
	var pointer interface{} = &dummy
	return pointer
}
