package crud

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"strings"

	pb "boyscouts.com/type/scouts"
	"google.golang.org/genproto/googleapis/type/date"
	"github.com/golang/protobuf/ptypes/timestamp"
	_ "github.com/go-sql-driver/mysql"
)

func dbConn() *sql.DB {
        dbDriver := "mysql"
        dbUser := "david"
        dbPass := ""
		dbName := "foo"
        // db, err := sql.Open(dbDriver, fmt.Sprintf("%s:%s@/%s?parseTime=true", dbUser, dbPass, dbName))
        db, err := sql.Open(dbDriver, fmt.Sprintf("%s:%s@/%s", dbUser, dbPass, dbName))
        if err != nil {
                panic(err.Error())
        }
        return db
}

type timestampScanner struct {
	 intermediary sql.NullInt64 // microseconds since unix epoch
	 destination **timestamp.Timestamp
}

func (scanner timestampScanner) Scan(value interface{}) (err error) {
	fmt.Printf("in timestampScanner.Scan: value has type %T: %v\n", value, value)

	err = scanner.intermediary.Scan(value)
	if err != nil {
		return
	}

	fmt.Println("ended up with", scanner.intermediary)

	if !scanner.intermediary.Valid {
		// "not valid" means null, which means nil
		*scanner.destination = nil
	} else {
		microsecondsSinceEpoch := scanner.intermediary.Int64
		*scanner.destination = &timestamp.Timestamp{
			Seconds: microsecondsSinceEpoch / 1_000_000,
			Nanos: int32(microsecondsSinceEpoch % 1_000_000) * 1000}
	}

	return
}

// intoTimestamp is a constructor for timestampScanner. It is convenient to use
// directly as an argument to sql.Row.Scan.
func intoTimestamp(destination **timestamp.Timestamp) timestampScanner {
	var scanner timestampScanner
	scanner.destination = destination
	return scanner
}

type dateScanner struct {
	intermediary sql.NullString // YYYY-MM-DD
    destination **date.Date
}

func (scanner dateScanner) Scan(value interface{}) error {
	fmt.Printf("in dateScanner.Scan: value has type %T: %v\n", value, value)

	err := scanner.intermediary.Scan(value)
	if err != nil {
		return err
	}

	fmt.Println("ended up with", scanner.intermediary)

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

// CreateBoyScout shut up linter
func CreateBoyScout(ctx context.Context, db *sql.DB, value pb.BoyScout) error {
	// TODO
	return nil
}

// ReadBoyScout shut up linter
func ReadBoyScout(ctx context.Context, db *sql.DB, id string) (*pb.BoyScout, error) {
	// TODO
	return nil, nil
}

func contains(slice []string, value string) bool {
	for _, element := range slice {
		if element == value {
			return true
		}
	}
	return false
}

/*
type BoyScout struct {
	Id            string
	FullName      string
	ShortName     string
	Birthdate     *date.Date
	JoinTime      *timestamp.Timestamp
	CountryCode   string
	LanguageCode  string
	PackCode      uint32
	Rank          Rank
	Badges        []Badge
	FavoriteSongs []string
}
*/

// UpdateBoyScout shut up linter
// We could have a `fieldMask` for all operations, but it's most useful for
// updates, and I'd like to keep it simple otherwise.
func UpdateBoyScout(ctx context.Context, db *sql.DB, value pb.BoyScout, fieldMask []string) error {
	/*
	var err error
	var transaction *sql.Tx
	var result sql.Result

	transaction, err = db.BeginTx(ctx, nil)
	*/
	return nil
}

// DeleteBoyScout shut up linter
func DeleteBoyScout(ctx context.Context, db *sql.DB, id string) error {
	// TODO
	return nil
}

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

type MyEnum int32

const (
	MyEnum_MYENUM_UNSET MyEnum = 0
	MyEnum_MYENUM_RED MyEnum = 1
	MyEnum_MYENUM_GREEN MyEnum = 2
	MyEnum_MYENUM_BLUE MyEnum = 3
)

func DoTheThing() {
	// err := UpdateBoyScout(context.TODO(), dbConn(), pb.BoyScout{}, []string{})
	// fmt.Println("err:", err)

	var transaction *sql.Tx
	var err error
	// var result sql.Result
	var db *sql.DB = dbConn()
	var ctx context.Context = context.TODO()
	var scout pb.BoyScout

	transaction, err = db.BeginTx(ctx, nil)
	if err != nil {
		panic(err)
	}

	// err = transaction.QueryRow("select now(6);").Scan(intoTimestamp(&scout.JoinTime))
	// fmt.Println("returned: ", err)

	err = transaction.QueryRow("select cast(unix_timestamp(now(6)) as signed);").Scan(intoTimestamp(&scout.JoinTime))
	fmt.Println("returned: ", err)

	err = transaction.QueryRow("select cast(12123 as signed);").Scan(intoTimestamp(&scout.JoinTime))
	fmt.Println("returned: ", err)

	err = transaction.QueryRow("select 10;").Scan(intoTimestamp(&scout.JoinTime))
	fmt.Println("returned: ", err)

	// err = transaction.QueryRow("select '';").Scan(intoTimestamp(&scout.JoinTime))
	// fmt.Println("returned: ", err)

	err = transaction.QueryRow("select 0;").Scan(intoTimestamp(&scout.JoinTime))
	fmt.Println("returned: ", err)

	err = transaction.QueryRow("select 1;").Scan(intoTimestamp(&scout.JoinTime))
	fmt.Println("returned: ", err)

	err = transaction.QueryRow("select 256;").Scan(intoTimestamp(&scout.JoinTime))
	fmt.Println("returned: ", err)

	var number int64
	err = transaction.QueryRow("select cast(unix_timestamp(now(6)) as signed);").Scan(&number)
	fmt.Println("returned: ", err)
	fmt.Println("number:", number)

	var nullNumber sql.NullInt64
	err = transaction.QueryRow("select cast(unix_timestamp(now(6)) as signed);").Scan(&nullNumber)
	fmt.Println("returned: ", err)
	fmt.Println("nullNumber:", nullNumber)

	fmt.Println("at the end of all that, scout.JoinTime is", scout.JoinTime)

	err = transaction.QueryRow("select curdate();").Scan(intoDate(&scout.Birthdate))
	fmt.Println("returned: ", err)
	fmt.Println("scout.Birthdate:", scout.Birthdate)

	fmt.Println(withTuples("insert into `foo`(`x`, `y`) values", "(?, ?)", 10))

	// The fact that this works makes dealing with proto enums easy.
	var color MyEnum
	err = transaction.QueryRow("select 25;").Scan(&color)
	fmt.Println("returned: ", err)
	fmt.Println("color:", color)

	fmt.Println(combineErrors(fmt.Errorf("hi"), fmt.Errorf("there")))
	
	transaction.Commit() // TODO: returns error
}
