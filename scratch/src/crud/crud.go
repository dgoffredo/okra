package crud

import (
	"database/sql"

	pb "boyscouts.com/type/scouts"
)

// CreateBoyScout shut up linter
func CreateBoyScout(db *sql.DB, value pb.BoyScout) error {
	// TODO
	return nil
}

// ReadBoyScout shut up linter
func ReadBoyScout(db *sql.DB, id string) (*pb.BoyScout, error) {
	// TODO
	return nil, nil
}

// UpdateBoyScout shut up linter
// We could have a `fieldMask` for all operations, but it's most useful for
// updates, and I'd like to keep it simple otherwise.
func UpdateBoyScout(db *sql.DB, value pb.BoyScout, fieldMask []string) error {
	// TODO
	return nil
}

// DeleteBoyScout shut up linter
func DeleteBoyScout(db *sql.DB, id string) error {
	// TODO
	return nil
}
