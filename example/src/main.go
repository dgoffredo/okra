package main

import (
	"context"
	"crud"
	"database/sql"
	"fmt"

	pb "boyscouts.com/type/scouts"
	"github.com/golang/protobuf/ptypes/timestamp"
	"google.golang.org/genproto/googleapis/type/date"

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

func main() {
	ted := pb.BoyScout{
		Id:              "1234-FOO-FOO",
		FullName:        "St. Vincent the Destroyer",
		ShortName:       "Ted",
		Birthdate:       &date.Date{Year: 2008, Month: 2, Day: 23},
		JoinTime:        &timestamp.Timestamp{Seconds: 1596228077, Nanos: 12345},
		CountryCode:     "US",
		LanguageCode:    "en",
		PackCode:        4,
		Rank:            pb.Rank_RANK_BOY_SCOUT,
		Badges:          []pb.Badge{pb.Badge_BADGE_BALLET},
		FavoriteSongs:   []string{"The Things - Something", "The Things - Do the Thing"},
		IANACountryCode: "whatever",
		WhatAboutThis:   42,
		// do we end up with an array of pointers?
		CampingTrips: nil}

	db := dbConn()
	ctx := context.TODO()
	err := crud.CreateBoyScout(ctx, db, &ted)
	fmt.Println("create error?: ", err)

	for i := 0; i < 3; i++ {
		err := crud.ReadBoyScout(ctx, db, &ted)
		fmt.Println(ted)
		fmt.Println("read error?: ", err)
	}

	fmt.Println("now for the update")

	// ted.FullName = "King of the Fishes"
	var moreTed pb.BoyScout
	moreTed.Id = ted.Id
	moreTed.FullName = "Teddicus Piscerius"
	// err = crud.UpdateBoyScout(ctx, db, moreTed, []string{"full_name", "favorite_songs"})
	err = crud.UpdateBoyScout(ctx, db, &moreTed, nil)
	fmt.Println("update error?: ", err)

	// err = crud.DeleteBoyScout(ctx, db, moreTed.Id)
	// fmt.Println(err)

	fmt.Println("we're done")
}
