package logging

import (
	"go.uber.org/zap"
)

// Init returns a configured zap.Logger. Pass dev=true for development-friendly logger.
func Init(dev bool) (*zap.Logger, error) {
	if dev {
		return zap.NewDevelopment()
	}
	return zap.NewProduction()
}
