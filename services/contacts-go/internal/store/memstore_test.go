package store

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMemStoreConcurrency(t *testing.T) {
	m := NewMemStore()
	var wg sync.WaitGroup
	count := 200
	errCh := make(chan error, count)
	wg.Add(count)
	for i := 0; i < count; i++ {
		go func(i int) {
			defer wg.Done()
			c := Contact{Name: fmt.Sprintf("Name-%d", i), Email: fmt.Sprintf("n%d@example.com", i)}
			_, err := m.Create(context.TODO(), c)
			if err != nil {
				errCh <- err
				return
			}
			// success
			errCh <- nil
		}(i)
	}
	wg.Wait()
	close(errCh)
	for e := range errCh {
		if e != nil {
			t.Fatalf("create failed: %v", e)
		}
	}
	all, err := m.List(context.TODO())
	assert.NoError(t, err)
	assert.Equal(t, count, len(all))
}
