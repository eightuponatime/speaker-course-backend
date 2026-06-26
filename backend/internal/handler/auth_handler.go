package handler

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"time"

	"speaker_course/config"
	"speaker_course/internal/domain"
	middlewarego "speaker_course/internal/middleware.go"
	"speaker_course/internal/service"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const googleOAuthStateCookieName = "google_oauth_state"
const googleOAuthModeCookieName = "google_oauth_mode"
const googleOAuthModeLink = "link"
const googleOAuthModeEnroll = "enroll"

type AuthHandler struct {
	cfg                  *config.Config
	authService          *service.AuthService
	sessionsService      *service.SessionsService
	usersService         *service.UsersService
	coursesService       *service.CoursesService
	enrollmentsService   *service.EnrollmentsService
	notificationsService *service.NotificationsService
	emailService         *service.EmailService
}

type authUserResponse struct {
	Id                string          `json:"id"`
	Email             string          `json:"email"`
	FullName          string          `json:"full_name"`
	Role              domain.UserRole `json:"role"`
	AuthProvider      string          `json:"auth_provider"`
	CanChangeEmail    bool            `json:"can_change_email"`
	CanChangePassword bool            `json:"can_change_password"`
	CreatedAt         time.Time       `json:"created_at"`
}

func NewAuthHandler(
	cfg *config.Config,
	authService *service.AuthService,
	sessionsService *service.SessionsService,
	usersService *service.UsersService,
	coursesService *service.CoursesService,
	enrollmentsService *service.EnrollmentsService,
	notificationsService *service.NotificationsService,
	emailService *service.EmailService,
) *AuthHandler {
	return &AuthHandler{
		cfg:                  cfg,
		authService:          authService,
		sessionsService:      sessionsService,
		usersService:         usersService,
		coursesService:       coursesService,
		enrollmentsService:   enrollmentsService,
		notificationsService: notificationsService,
		emailService:         emailService,
	}
}

func (h *AuthHandler) RegisterRoutes(r chi.Router, authMiddleware *middlewarego.AuthMiddleware) {
	r.Post("/auth/register", h.Register)
	r.Post("/auth/login", h.Login)
	r.Post("/auth/forgot-password", h.ForgotPassword)
	r.Get("/auth/google/start", h.GoogleStart)
	r.Get("/auth/google/enroll/start", h.GoogleEnrollStart)
	r.Get("/auth/google/callback", h.GoogleCallback)

	r.Group(func(r chi.Router) {
		r.Use(authMiddleware.RequireAuth())

		r.Get("/auth/me", h.Me)
		r.Get("/auth/google/link/start", h.GoogleLinkStart)
		r.Patch("/auth/me", h.UpdateMe)
		r.Patch("/auth/me/password", h.ChangePassword)
		r.Delete("/auth/me", h.DeleteMe)
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
	writeJSON(w, http.StatusCreated, buildAuthUserResponse(result.User))
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
	writeJSON(w, http.StatusOK, buildAuthUserResponse(result.User))
}

func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	temporaryPassword, err := randomTemporaryPassword()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	user, err := h.usersService.SetTemporaryPassword(r.Context(), request.Email, temporaryPassword)
	if err == nil && user != nil {
		_ = h.sessionsService.RevokeByUser(r.Context(), user.Id)
		_ = h.emailService.Send(r.Context(), service.TemporaryPasswordEmail(user.Email, user.FullName, temporaryPassword))
	}

	w.WriteHeader(http.StatusNoContent)
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

	writeJSON(w, http.StatusOK, buildAuthUserResponse(user))
}

func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	var request struct {
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	user, err := h.usersService.UpdateProfile(r.Context(), userID, domain.UpdateUserProfileInput{
		Email:    request.Email,
		FullName: request.FullName,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, buildAuthUserResponse(user))
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	var request struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
		RepeatPassword  string `json:"repeat_password"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if request.NewPassword != request.RepeatPassword {
		writeError(w, http.StatusBadRequest, service.ErrInvalidUser)
		return
	}

	if err := h.usersService.ChangePassword(r.Context(), userID, request.CurrentPassword, request.NewPassword); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) DeleteMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	if err := h.usersService.Delete(r.Context(), userID); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	_ = h.sessionsService.RevokeByUser(r.Context(), userID)
	h.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
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
	h.clearOAuthModeCookie(w)
	http.Redirect(w, r, authURL, http.StatusFound)
}

func (h *AuthHandler) GoogleLinkStart(w http.ResponseWriter, r *http.Request) {
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
	h.setOAuthModeCookie(w, googleOAuthModeLink)
	http.Redirect(w, r, authURL, http.StatusFound)
}

func (h *AuthHandler) GoogleEnrollStart(w http.ResponseWriter, r *http.Request) {
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
	h.setOAuthModeCookie(w, googleOAuthModeEnroll)
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
	modeCookie, _ := r.Cookie(googleOAuthModeCookieName)
	if modeCookie != nil && modeCookie.Value == googleOAuthModeLink {
		h.clearOAuthModeCookie(w)

		sessionCookie, err := r.Cookie(middlewarego.SessionCookieName)
		if err != nil || sessionCookie.Value == "" {
			writeError(w, http.StatusUnauthorized, service.ErrInvalidSession)
			return
		}

		sessionID, err := uuid.Parse(sessionCookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, service.ErrInvalidSession)
			return
		}

		session, err := h.sessionsService.GetValidByID(r.Context(), sessionID)
		if err != nil || session == nil {
			writeError(w, http.StatusUnauthorized, service.ErrInvalidSession)
			return
		}

		if _, err := h.authService.LinkGoogleCode(r.Context(), session.UserId, code); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		http.Redirect(w, r, h.cfg.FrontendURL, http.StatusFound)
		return
	}

	var result *service.AuthResult
	if modeCookie != nil && modeCookie.Value == googleOAuthModeEnroll {
		result, err = h.authService.RegisterOrLoginWithGoogleCode(r.Context(), code)
	} else {
		result, err = h.authService.LoginWithGoogleCode(r.Context(), code)
	}
	if err != nil {
		if errors.Is(err, service.ErrGoogleAccountNotFound) {
			h.clearOAuthModeCookie(w)
			http.Redirect(w, r, h.frontendURLWithError("google_account_not_found"), http.StatusFound)
			return
		}

		writeError(w, http.StatusUnauthorized, err)
		return
	}

	h.setSessionCookie(w, result.Session.Id.String(), result.Session.ExpiresAt)
	if modeCookie != nil && modeCookie.Value == googleOAuthModeEnroll {
		h.clearOAuthModeCookie(w)
		if err := h.requestPrimaryCourseEnrollment(r.Context(), result.User.Id); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
	}
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

func (h *AuthHandler) setOAuthModeCookie(w http.ResponseWriter, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     googleOAuthModeCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   10 * 60,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.cfg.Env != "development",
	})
}

func (h *AuthHandler) clearOAuthModeCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     googleOAuthModeCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.cfg.Env != "development",
	})
}

func (h *AuthHandler) frontendURLWithError(code string) string {
	frontendURL := h.cfg.FrontendURL
	parsedURL, err := url.Parse(frontendURL)
	if err != nil {
		return frontendURL
	}

	query := parsedURL.Query()
	query.Set("auth_error", code)
	parsedURL.RawQuery = query.Encode()
	return parsedURL.String()
}

func randomState() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func buildAuthUserResponse(user *domain.User) authUserResponse {
	provider := "password"
	if user.GoogleSub != nil && user.Password == nil {
		provider = "google"
	} else if user.GoogleSub != nil && user.Password != nil {
		provider = "google_password"
	}

	return authUserResponse{
		Id:                user.Id.String(),
		Email:             user.Email,
		FullName:          user.FullName,
		Role:              user.Role,
		AuthProvider:      provider,
		CanChangeEmail:    user.GoogleSub == nil,
		CanChangePassword: user.Password != nil,
		CreatedAt:         user.CreatedAt,
	}
}

func (h *AuthHandler) requestPrimaryCourseEnrollment(ctx context.Context, userID uuid.UUID) error {
	course, err := h.coursesService.GetPrimaryCourse(ctx)
	if err != nil {
		return err
	}
	if course == nil {
		return service.ErrInvalidCourse
	}

	existingEnrollment, err := h.enrollmentsService.GetByCourseAndUser(ctx, course.Id, userID)
	if err != nil {
		return err
	}

	enrollment, err := h.enrollmentsService.RequestAccess(ctx, domain.CreateCourseEnrollmentInput{
		CourseId: course.Id,
		UserId:   userID,
	})
	if err != nil {
		return err
	}

	if existingEnrollment == nil {
		h.notifyAdminsAboutEnrollmentRequest(ctx, userID, course.Id, enrollment.Id, course.Title)
		h.emailCourseAccessRequested(ctx, userID, course.Title)
	}

	return nil
}

func (h *AuthHandler) emailCourseAccessRequested(ctx context.Context, userID uuid.UUID, courseTitle string) {
	user, err := h.usersService.GetByID(ctx, userID)
	if err != nil || user == nil {
		return
	}

	_ = h.emailService.Send(ctx, service.EnrollmentRequestedEmail(user.Email, user.FullName, courseTitle))
}

func (h *AuthHandler) notifyAdminsAboutEnrollmentRequest(
	ctx context.Context,
	actorID uuid.UUID,
	courseID uuid.UUID,
	enrollmentID uuid.UUID,
	courseTitle string,
) {
	admins, err := h.usersService.ListAdmins(ctx)
	if err != nil {
		return
	}
	student, _ := h.usersService.GetByID(ctx, actorID)
	studentEmail := ""
	studentName := ""
	if student != nil {
		studentEmail = student.Email
		studentName = student.FullName
	}

	for _, admin := range admins {
		if admin.Id == actorID || admin.Email == "system@logos-voice.local" {
			continue
		}

		_, _ = h.notificationsService.Create(ctx, domain.CreateNotificationInput{
			UserId:       admin.Id,
			ActorId:      &actorID,
			CourseId:     &courseID,
			EnrollmentId: &enrollmentID,
			Type:         domain.NotificationCourseEnrollmentRequested,
			Title:        "New course access request",
			Body:         "A student requested access to " + courseTitle + ".",
		})
		_ = h.emailService.Send(ctx, service.AdminEnrollmentRequestedEmail(
			admin.Email,
			admin.FullName,
			studentName,
			studentEmail,
			courseTitle,
			h.cfg.FrontendURL+"/admin",
		))
	}
}

func randomTemporaryPassword() (string, error) {
	bytes := make([]byte, 15)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
