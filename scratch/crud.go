import (
	pb "blah/blah/blah/blah"
	"database/sql"
)

func CreateUserDetails(db *sql.DB, value pb.UserDetails) error {
	// ...
}

func ReadUserDetails(db *sql.DB, id int32) (*pb.UserDetails, error) {
	// ...
}

// We could have a `fieldMask` for all operations, but it's most useful for
// updates, and I'd like to keep it simple otherwise.
func UpdateUserDetails(db *sql.DB, value pb.UserDetails, fieldMask []string) error {
	// ...
}

func DeleteUserDetails(db *sql.DB, id int32) error {
	// ...
}
