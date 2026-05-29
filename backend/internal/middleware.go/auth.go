package middlewarego

import (
	"context"
	"encoding/json"
	"net/http"
	"speaker_course/internal/service"

	"github.com/google/uuid"
)

const SessionCookieName = "session_id"

type contextKey string

const (
	userIDContextKey    contextKey = "user_id"
	sessionIDContextKey contextKey = "session_id"
)

type AuthMiddleware struct {
	sessionsService service.SessionsService
}

func NewAuthMiddleware(
	sessionsService service.SessionsService,
) *AuthMiddleware {
	return &AuthMiddleware{
		sessionsService: sessionsService,
	}
}

func (am *AuthMiddleware) RequireAuth() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil || cookie.Value == "" {
				return
			}

			sessionID, err := uuid.Parse(cookie.Value)
			if err != nil {
				writeUnauthorized(w)
				return
			}

			session, err := am.sessionsService.GetValidByID(r.Context(), sessionID)
			if err != nil || session == nil {
				writeUnauthorized(w)
				return
			}

			ctx := context.WithValue(r.Context(), sessionIDContextKey, session.Id)
			ctx = context.WithValue(ctx, userIDContextKey, session.UserId)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": "unauthorized",
	})
}
