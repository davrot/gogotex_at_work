package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/overleaf/contacts-go/internal/logging"
	"github.com/overleaf/contacts-go/internal/metrics"
)

// RequestLogger returns a middleware that sets a request id, measures latency and logs basic request info
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// assign request id
		reqID := c.GetHeader("X-Request-ID")
		if reqID == "" {
			reqID = uuid.New().String()
			c.Request.Header.Set("X-Request-ID", reqID)
		}

		start := time.Now()
		c.Next()
		d := time.Since(start).Seconds()

		// record duration
		metrics.RequestDuration.Observe(d)

		// structured log (if initialized)
		if logging.Logger != nil {
			logging.Logger.Sugar().Infow("http_request",
				"method", c.Request.Method,
				"path", c.Request.URL.Path,
				"status", c.Writer.Status(),
				"duration_s", d,
				"request_id", reqID,
			)
		}
	}
}
