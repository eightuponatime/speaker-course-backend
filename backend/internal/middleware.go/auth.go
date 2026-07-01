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
	sessionsService *service.SessionsService
	usersService    *service.UsersService
}

func NewAuthMiddleware(
	sessionsService *service.SessionsService,
	usersService *service.UsersService,
) *AuthMiddleware {
	return &AuthMiddleware{
		sessionsService: sessionsService,
		usersService:    usersService,
	}
}

func (am *AuthMiddleware) RequireAuth() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(SessionCookieName)
			if err != nil || cookie.Value == "" {
				writeUnauthorized(w)
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

func (am *AuthMiddleware) RequireAdmin() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := UserIDFromContext(r.Context())
			if !ok {
				writeUnauthorized(w)
				return
			}

			user, err := am.usersService.GetByID(r.Context(), userID)
			if err != nil || user == nil {
				writeUnauthorized(w)
				return
			}

			if !user.Role.IsAdmin() {
				writeForbidden(w)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	userID, ok := ctx.Value(userIDContextKey).(uuid.UUID)
	return userID, ok
}

func SessionIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	sessionID, ok := ctx.Value(sessionIDContextKey).(uuid.UUID)
	return sessionID, ok
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": "unauthorized",
	})
}

func writeForbidden(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": "forbidden",
	})
}
