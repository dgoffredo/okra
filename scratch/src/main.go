package main

import (
	"crud"
	"fmt"
)

func main() {
	crud.DeleteBoyScout(nil, "hello")
	fmt.Println("we're done")
}
