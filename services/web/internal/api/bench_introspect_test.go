package api

import (
	"testing"
	"github.com/davrot/gogotex_at_work/services/web/internal/token"
)

func BenchmarkManagerIntrospect(b *testing.B) {
	m := token.New()
	m.Create("bench-token-1", "u-1", []string{"repo:read"})
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		m.Introspect("bench-token-1")
	}
}
