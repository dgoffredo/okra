import "database/sql"

func CreateUserDetails(db *sql.DB, value pb.UserDetails) error {
	// ...
}

func UpdateUserDetails(db *sql.DB, value pb.UserDetails, fieldMask []string) error {
	// ...
}

func ReadUserDetails(db *sql.DB, id int32) (*UserDetails, error) {
	// ...
}

func ReadMultipleUserDetails(db *sql.DB, ids []int32) ([]*UserDetails, error) {
	// ...
}

func DeleteUserDetails(db *sql.DB, id []int32) error {
	// ...
}
