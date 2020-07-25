package main

import (
	"fmt"
)

func doTheThing(whatThings []string, reallyThough bool) {
	var counter int = len(whatThings)

	fmt.Println("the counter is at:", counter)
}

func main() {
	doTheThing([]string{"foo", "bar"}, true)
}
