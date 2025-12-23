// Package config provides environment-based configuration helpers for the service.
package config

import "os"

// Port returns the port the service should listen on (string, without colon)
func Port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}
