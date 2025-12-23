package historyv1go
package main

























}	}		log.Fatal(err)	if err := http.ListenAndServe(addr, nil); err != nil {	log.Printf("listening on %s", addr)	http.HandleFunc("/health", healthHandler)	addr := ":" + port	}		port = "8080"	if port == "" {	port := os.Getenv("PORT")func main() {}	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})	w.Header().Set("Content-Type", "application/json")func healthHandler(w http.ResponseWriter, r *http.Request) {)	"os"	"net/http"	"log"	"encoding/json"import (