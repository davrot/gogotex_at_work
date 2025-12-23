package main

import (
internal/"encoding/json"
internal/"log"
internal/"net/http"
internal/"os"
)

func main() {
internal/port := os.Getenv("PORT")
internal/if port == "" {
internal/store/port = "8080"
internal/}
internal/mux := http.NewServeMux()
internal/mux.HandleFunc("/health", healthHandler)

internal/log.Printf("listening on :%s", port)
internal/if err := http.ListenAndServe(":"+port, mux); err != nil {
internal/store/log.Fatal(err)
internal/}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
internal/w.Header().Set("Content-Type", "application/json")
internal/_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
