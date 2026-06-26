package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"speaker_course/config"
	"speaker_course/internal/domain"

	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidAuth = errors.New("invalid auth")

type AuthService struct {
	cfg             *config.Config
	usersService    *UsersService
	sessionsService *SessionsService
	httpClient      *http.Client
}

type AuthResult struct {
	User    *domain.User     `json:"user"`
	Session *domain.Sessions `json:"session"`
}

type RegisterWithPasswordInput struct {
	Email    string
	Password string
	FullName string
}

type LoginWithPasswordInput struct {
	Email    string
	Password string
}

type googleTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
	IDToken     string `json:"id_token"`
}

type googleUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
}

func NewAuthService(
	cfg *config.Config,
	usersService *UsersService,
	sessionsService *SessionsService,
) *AuthService {
	return &AuthService{
		cfg:             cfg,
		usersService:    usersService,
		sessionsService: sessionsService,
		httpClient:      http.DefaultClient,
	}
}

func (s *AuthService) RegisterWithPassword(
	ctx context.Context,
	input RegisterWithPasswordInput,
) (*AuthResult, error) {
	existing, err := s.usersService.GetByEmail(ctx, input.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		if existing.Password == nil && existing.GoogleSub != nil {
			return nil, fmt.Errorf("%w: this email uses google sign-in", ErrInvalidAuth)
		}

		return nil, fmt.Errorf("%w: user with this email already exists", ErrInvalidAuth)
	}

	if strings.TrimSpace(input.Password) == "" {
		return nil, fmt.Errorf("%w: password is empty", ErrInvalidAuth)
	}
	if len(input.Password) < 8 {
		return nil, fmt.Errorf("%w: password must contain at least 8 characters", ErrInvalidAuth)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	passwordHash := string(hash)
	user, err := s.usersService.Create(ctx, domain.CreateUserInput{
		Email:    input.Email,
		Password: &passwordHash,
		FullName: input.FullName,
		Role:     domain.UserRoleMember,
	})
	if err != nil {
		return nil, err
	}

	session, err := s.sessionsService.Create(ctx, user.Id)
	if err != nil {
		return nil, err
	}

	return &AuthResult{User: user, Session: session}, nil
}

func (s *AuthService) LoginWithPassword(
	ctx context.Context,
	input LoginWithPasswordInput,
) (*AuthResult, error) {
	user, err := s.usersService.GetByEmail(ctx, input.Email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("%w: email or password is incorrect", ErrInvalidAuth)
	}
	if user.Password == nil {
		if user.GoogleSub != nil {
			return nil, fmt.Errorf("%w: this account uses google sign-in", ErrInvalidAuth)
		}

		return nil, fmt.Errorf("%w: email or password is incorrect", ErrInvalidAuth)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.Password), []byte(input.Password)); err != nil {
		return nil, fmt.Errorf("%w: email or password is incorrect", ErrInvalidAuth)
	}

	session, err := s.sessionsService.Create(ctx, user.Id)
	if err != nil {
		return nil, err
	}

	return &AuthResult{User: user, Session: session}, nil
}

func (s *AuthService) GoogleAuthURL(state string) (string, error) {
	if s.cfg.GoogleClientID == "" || s.cfg.GoogleRedirectURL == "" {
		return "", fmt.Errorf("%w: google oauth is not configured", ErrInvalidAuth)
	}
	if strings.TrimSpace(state) == "" {
		return "", fmt.Errorf("%w: oauth state is empty", ErrInvalidAuth)
	}

	params := url.Values{}
	params.Set("client_id", s.cfg.GoogleClientID)
	params.Set("redirect_uri", s.cfg.GoogleRedirectURL)
	params.Set("response_type", "code")
	params.Set("scope", "openid email profile")
	params.Set("state", state)

	return "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode(), nil
}

func (s *AuthService) LoginWithGoogleCode(ctx context.Context, code string) (*AuthResult, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, fmt.Errorf("%w: oauth code is empty", ErrInvalidAuth)
	}

	token, err := s.exchangeGoogleCode(ctx, code)
	if err != nil {
		return nil, err
	}

	info, err := s.fetchGoogleUserInfo(ctx, token.AccessToken)
	if err != nil {
		return nil, err
	}
	if info.Sub == "" || info.Email == "" || !info.EmailVerified {
		return nil, fmt.Errorf("%w: google account email is not verified", ErrInvalidAuth)
	}

	user, err := s.usersService.GetByGoogleSub(ctx, info.Sub)
	if err != nil {
		return nil, err
	}

	if user == nil {
		user, err = s.usersService.GetByEmail(ctx, info.Email)
		if err != nil {
			return nil, err
		}
	}

	if user == nil {
		googleSub := info.Sub
		fullName := strings.TrimSpace(info.Name)
		if fullName == "" {
			fullName = info.Email
		}

		user, err = s.usersService.Create(ctx, domain.CreateUserInput{
			GoogleSub: &googleSub,
			Email:     info.Email,
			FullName:  fullName,
			Role:      domain.UserRoleMember,
		})
		if err != nil {
			return nil, err
		}
	} else if user.GoogleSub == nil {
		user, err = s.usersService.UpdateGoogleSub(ctx, user.Id, info.Sub)
		if err != nil {
			return nil, err
		}
	} else if *user.GoogleSub != info.Sub {
		return nil, fmt.Errorf("%w: email is linked to another google account", ErrInvalidAuth)
	}

	if user.GoogleSub != nil && *user.GoogleSub == info.Sub && user.Email != strings.ToLower(strings.TrimSpace(info.Email)) {
		user, err = s.usersService.SyncGoogleEmail(ctx, user.Id, info.Email)
		if err != nil {
			return nil, err
		}
	}

	session, err := s.sessionsService.Create(ctx, user.Id)
	if err != nil {
		return nil, err
	}

	return &AuthResult{User: user, Session: session}, nil
}

func (s *AuthService) exchangeGoogleCode(ctx context.Context, code string) (*googleTokenResponse, error) {
	if s.cfg.GoogleClientID == "" || s.cfg.GoogleSecret == "" || s.cfg.GoogleRedirectURL == "" {
		return nil, fmt.Errorf("%w: google oauth is not configured", ErrInvalidAuth)
	}

	form := url.Values{}
	form.Set("client_id", s.cfg.GoogleClientID)
	form.Set("client_secret", s.cfg.GoogleSecret)
	form.Set("code", code)
	form.Set("grant_type", "authorization_code")
	form.Set("redirect_uri", s.cfg.GoogleRedirectURL)

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		"https://oauth2.googleapis.com/token",
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	response, err := s.httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: google token exchange failed", ErrInvalidAuth)
	}

	var token googleTokenResponse
	if err := json.NewDecoder(response.Body).Decode(&token); err != nil {
		return nil, err
	}
	if token.AccessToken == "" {
		return nil, fmt.Errorf("%w: google access token is empty", ErrInvalidAuth)
	}

	return &token, nil
}

func (s *AuthService) fetchGoogleUserInfo(ctx context.Context, accessToken string) (*googleUserInfo, error) {
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"https://www.googleapis.com/oauth2/v3/userinfo",
		nil,
	)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)

	response, err := s.httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: google userinfo request failed", ErrInvalidAuth)
	}

	var info googleUserInfo
	if err := json.NewDecoder(response.Body).Decode(&info); err != nil {
		return nil, err
	}

	return &info, nil
}
