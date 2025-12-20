package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
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
	// Start a minimal HTTP server (health endpoint) on port from PORT env or default 8080
	port := "8080"
	if p := getenv("PORT"); p != "" {
		port = p
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})
	addr := fmt.Sprintf(":%s", port)
	log.Printf("http server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("http server failed: %v", err)
	}
}

func getenv(k string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return ""
}
