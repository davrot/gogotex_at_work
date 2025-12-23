// Package logging provides a thin wrapper around zap logger for the service.
package logging

import (
	"go.uber.org/zap"
)

// Logger is the global zap logger used by the service (may be nil in tests).
var Logger *zap.Logger

// Init initializes the global logger.
func Init() error {
	var err error
	Logger, err = zap.NewProduction()
	if err != nil {
		return err
	}
	return nil
}

// Sync flushes any buffered log entries.
func Sync() {
	if Logger != nil {
		_ = Logger.Sync()
	}
}
