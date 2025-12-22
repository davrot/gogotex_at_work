package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func statusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode("chat is alive")
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3011"
	}
	addr := ":" + port
	mux := http.NewServeMux()
	mux.HandleFunc("/status", statusHandler)

	log.Printf("chat service listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
