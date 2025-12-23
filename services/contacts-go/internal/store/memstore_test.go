package store

import (
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMemStoreConcurrency(t *testing.T) {
	m := NewMemStore()
	var wg sync.WaitGroup
	count := 200
	wg.Add(count)
	for i := 0; i < count; i++ {
		go func(i int) {
			defer wg.Done()
			c := Contact{Name: fmt.Sprintf("Name-%d", i), Email: fmt.Sprintf("n%d@example.com", i)}
			_, err := m.Create(nil, c)
			if err != nil {
				t.Fatalf("create failed: %v", err)
			}
		}(i)
	}
	wg.Wait()
	all, err := m.List(nil)
	assert.NoError(t, err)
	assert.Equal(t, count, len(all))
}
