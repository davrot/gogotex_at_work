// Package contacts provides HTTP handlers for the contacts endpoints.
package contacts

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/overleaf/contacts-go/internal/store"
)

// Handler handles HTTP requests for contacts operations.
type Handler struct {
	store store.Store
}

// NewHandler returns a new Handler backed by the provided Store.
func NewHandler(s store.Store) *Handler { return &Handler{store: s} }

// Register registers the contacts routes onto the provided Gin engine.
func (h *Handler) Register(r *gin.Engine) {
	r.GET("/contacts", h.list)
	r.POST("/contacts", h.create)
}

func (h *Handler) list(c *gin.Context) {
	ctx := c.Request.Context()
	contacts, _ := h.store.List(ctx)
	c.JSON(http.StatusOK, contacts)
}

func (h *Handler) create(c *gin.Context) {
	var in store.Contact
	if err := c.BindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	ctx := c.Request.Context()
	out, _ := h.store.Create(ctx, in)
	c.JSON(http.StatusCreated, out)
}
