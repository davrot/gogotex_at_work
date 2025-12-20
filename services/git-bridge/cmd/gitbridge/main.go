package main

import (
	"flag"
	"fmt"
	"log"
)

var version = "dev"

func main() {
	config := flag.String("config", "conf/runtime.json", "path to runtime config file")
	v := flag.Bool("version", false, "print version and exit")
	flag.Parse()
	if *v {
		fmt.Printf("git-bridge (go) version: %s\n", version)
		return
	}
	log.Printf("Starting git-bridge (go) with config=%s", *config)
	// TODO: implement SSH server, HTTP handlers, membership checks and introspection client
	// For now, exit successfully so CI/dev can exercise build/test lifecycle.
}
