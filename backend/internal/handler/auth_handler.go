package handler

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"time"

	"speaker_course/config"
	middlewarego "speaker_course/internal/middleware.go"
	"speaker_course/internal/service"

	"github.com/go-chi/chi/v5"
)

const googleOAuthStateCookieName = "google_oauth_state"

type AuthHandler struct {
	cfg             *config.Config
	authService     *service.AuthService
	sessionsService *service.SessionsService
	usersService    *service.UsersService
}

func NewAuthHandler(
	cfg *config.Config,
	authService *service.AuthService,
	sessionsService *service.SessionsService,
	usersService *service.UsersService,
) *AuthHandler {
	return &AuthHandler{
		cfg:             cfg,
		authService:     authService,
		sessionsService: sessionsService,
		usersService:    usersService,
	}
}

func (h *AuthHandler) RegisterRoutes(r chi.Router, authMiddleware *middlewarego.AuthMiddleware) {
	r.Post("/auth/register", h.Register)
	r.Post("/auth/login", h.Login)
	r.Get("/auth/google/start", h.GoogleStart)
	r.Get("/auth/google/callback", h.GoogleCallback)

	r.Group(func(r chi.Router) {
		r.Use(authMiddleware.RequireAuth())

		r.Get("/auth/me", h.Me)
		r.Post("/auth/logout", h.Logout)
	})
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		FullName string `json:"full_name"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	result, err := h.authService.RegisterWithPassword(r.Context(), service.RegisterWithPasswordInput{
		Email:    request.Email,
		Password: request.Password,
		FullName: request.FullName,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	h.setSessionCookie(w, result.Session.Id.String(), result.Session.ExpiresAt)
	writeJSON(w, http.StatusCreated, result.User)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	result, err := h.authService.LoginWithPassword(r.Context(), service.LoginWithPasswordInput{
		Email:    request.Email,
		Password: request.Password,
	})
	if err != nil {
		writeError(w, http.StatusUnauthorized, err)
		return
	}

	h.setSessionCookie(w, result.Session.Id.String(), result.Session.ExpiresAt)
	writeJSON(w, http.StatusOK, result.User)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	sessionID, ok := middlewarego.SessionIDFromContext(r.Context())
	if ok {
		_ = h.sessionsService.Revoke(r.Context(), sessionID)
	}

	h.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	user, err := h.usersService.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) GoogleStart(w http.ResponseWriter, r *http.Request) {
	state, err := randomState()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	authURL, err := h.authService.GoogleAuthURL(state)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	h.setOAuthStateCookie(w, state)
	http.Redirect(w, r, authURL, http.StatusFound)
}

func (h *AuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	stateCookie, err := r.Cookie(googleOAuthStateCookieName)
	if err != nil || stateCookie.Value == "" || stateCookie.Value != r.URL.Query().Get("state") {
		writeError(w, http.StatusBadRequest, service.ErrInvalidAuth)
		return
	}
	h.clearOAuthStateCookie(w)

	code := r.URL.Query().Get("code")
	result, err := h.authService.LoginWithGoogleCode(r.Context(), code)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err)
		return
	}

	h.setSessionCookie(w, result.Session.Id.String(), result.Session.ExpiresAt)
	http.Redirect(w, r, h.cfg.FrontendURL, http.StatusFound)
}

func (h *AuthHandler) setSessionCookie(w http.ResponseWriter, value string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     middlewarego.SessionCookieName,
		Value:    value,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.cfg.Env != "development",
	})
}

func (h *AuthHandler) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     middlewarego.SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.cfg.Env != "development",
	})
}

func (h *AuthHandler) setOAuthStateCookie(w http.ResponseWriter, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     googleOAuthStateCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   10 * 60,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.cfg.Env != "development",
	})
}

func (h *AuthHandler) clearOAuthStateCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     googleOAuthStateCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.cfg.Env != "development",
	})
}

func randomState() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
