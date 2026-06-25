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
	"golang.org/x/crypto/bcrypt"
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

func (s *UsersService) UpdateProfile(
	ctx context.Context,
	userID uuid.UUID,
	input domain.UpdateUserProfileInput,
) (*domain.User, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("%w: id is empty", ErrInvalidUser)
	}

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

	existing, err := s.rp.GetByEmail(ctx, input.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.Id != userID {
		return nil, fmt.Errorf("%w: user with this email already exists", ErrInvalidUser)
	}

	return s.rp.UpdateProfile(ctx, userID, input)
}

func (s *UsersService) ChangePassword(
	ctx context.Context,
	userID uuid.UUID,
	currentPassword string,
	newPassword string,
) error {
	if userID == uuid.Nil {
		return fmt.Errorf("%w: id is empty", ErrInvalidUser)
	}

	user, err := s.rp.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return fmt.Errorf("%w: user not found", ErrInvalidUser)
	}
	if user.Password == nil {
		return fmt.Errorf("%w: password is not set for this account", ErrInvalidUser)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.Password), []byte(currentPassword)); err != nil {
		return fmt.Errorf("%w: current password is incorrect", ErrInvalidUser)
	}

	hash, err := hashPassword(newPassword)
	if err != nil {
		return err
	}

	_, err = s.rp.UpdatePassword(ctx, userID, hash)
	return err
}

func (s *UsersService) SetTemporaryPassword(
	ctx context.Context,
	email string,
	temporaryPassword string,
) (*domain.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, fmt.Errorf("%w: email is empty", ErrInvalidUser)
	}

	user, err := s.rp.GetByEmail(ctx, email)
	if err != nil || user == nil {
		return user, err
	}
	if user.Password == nil {
		return nil, fmt.Errorf("%w: this account uses google sign-in", ErrInvalidUser)
	}

	hash, err := hashPassword(temporaryPassword)
	if err != nil {
		return nil, err
	}

	return s.rp.UpdatePassword(ctx, user.Id, hash)
}

func (s *UsersService) Delete(ctx context.Context, userID uuid.UUID) error {
	if userID == uuid.Nil {
		return fmt.Errorf("%w: id is empty", ErrInvalidUser)
	}

	user, err := s.rp.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return nil
	}
	if user.Role == domain.UserRoleAdmin {
		return fmt.Errorf("%w: admin account cannot be deleted here", ErrInvalidUser)
	}

	return s.rp.Delete(ctx, userID)
}

func hashPassword(password string) (string, error) {
	password = strings.TrimSpace(password)
	if password == "" {
		return "", fmt.Errorf("%w: password is empty", ErrInvalidUser)
	}
	if len(password) < 8 {
		return "", fmt.Errorf("%w: password must contain at least 8 characters", ErrInvalidUser)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	return string(hash), nil
}
