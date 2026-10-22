package handler

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"speaker_course/internal/service"
	"testing"
)

func TestWriteMediaErrorStatus(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"invalid request", service.ErrInvalidMedia, http.StatusBadRequest},
		{"bunny unavailable", service.ErrMediaProvider, http.StatusBadGateway},
		{"database failure", errors.New("database unavailable"), http.StatusInternalServerError},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			writeMediaError(response, test.err)
			if response.Code != test.want {
				t.Fatalf("got HTTP %d, want %d", response.Code, test.want)
			}
		})
	}
}
