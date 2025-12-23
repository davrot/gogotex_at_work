package main

import (
"log"
"net/http"
"os"

"github.com/overleaf/docstore-go/internal/documents"
"github.com/overleaf/docstore-go/internal/store"
)

func main() {
port := os.Getenv("PORT")
if port == "" {
port = "8080"
}
mux := http.NewServeMux()
s := store.NewMemStore()
h := documents.NewHandler(s)
h.Register(mux)

log.Printf("listening on :%s", port)
if err := http.ListenAndServe(":"+port, mux); err != nil {
log.Fatal(err)
}
}
