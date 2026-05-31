package service

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"speaker_course/internal/domain"
	"speaker_course/internal/repository"

	"github.com/google/uuid"
)

var ErrInvalidUser = errors.New("invalid user")

type UsersService struct {
	rp *repository.UsersRepository
}

func NewUsersService(rp *repository.UsersRepository) *UsersService {
	return &UsersService{rp: rp}
}

func (s *UsersService) Create(ctx context.Context, input domain.CreateUserInput) (*domain.User, error) {
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.FullName = strings.TrimSpace(input.FullName)

	if input.Email == "" {
		return nil, fmt.Errorf("%w: email is empty", ErrInvalidUser)
	}
	if _, err := mail.ParseAddress(input.Email); err != nil {
		return nil, fmt.Errorf("%w: email is invalid", ErrInvalidUser)
	}
	if input.FullName == "" {
		return nil, fmt.Errorf("%w: full_name is empty", ErrInvalidUser)
	}
	if input.GoogleSub == nil && input.Password == nil {
		return nil, fmt.Errorf("%w: password or google_sub is required", ErrInvalidUser)
	}
	if input.Role == "" {
		input.Role = domain.UserRoleMember
	}
	if input.Role != domain.UserRoleAdmin && input.Role != domain.UserRoleMember {
		return nil, fmt.Errorf("%w: unsupported role %q", ErrInvalidUser, input.Role)
	}

	return s.rp.Create(ctx, input)
}

func (s *UsersService) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	if id == uuid.Nil {
		return nil, fmt.Errorf("%w: id is empty", ErrInvalidUser)
	}

	return s.rp.GetByID(ctx, id)
}

func (s *UsersService) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, fmt.Errorf("%w: email is empty", ErrInvalidUser)
	}

	return s.rp.GetByEmail(ctx, email)
}

func (s *UsersService) GetByGoogleSub(ctx context.Context, googleSub string) (*domain.User, error) {
	googleSub = strings.TrimSpace(googleSub)
	if googleSub == "" {
		return nil, fmt.Errorf("%w: google_sub is empty", ErrInvalidUser)
	}

	return s.rp.GetByGoogleSub(ctx, googleSub)
}

func (s *UsersService) UpdateGoogleSub(
	ctx context.Context,
	userID uuid.UUID,
	googleSub string,
) (*domain.User, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("%w: id is empty", ErrInvalidUser)
	}

	googleSub = strings.TrimSpace(googleSub)
	if googleSub == "" {
		return nil, fmt.Errorf("%w: google_sub is empty", ErrInvalidUser)
	}

	return s.rp.UpdateGoogleSub(ctx, userID, googleSub)
}
