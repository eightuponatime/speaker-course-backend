package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"speaker_course/config"
	"speaker_course/internal/domain"
	"speaker_course/internal/repository"

	"github.com/google/uuid"
)

var ErrInvalidInvitationCode = errors.New("invalid invitation code")

type InvitationCodesService struct {
	cfg           *config.Config
	rp            *repository.InvitationCodesRepository
	enrollmentsRp *repository.EnrollmentsRepository
	txManager     *repository.TransactionManager
	authService   *AuthService
	codeTTL       time.Duration
}

func NewInvitationCodesService(
	cfg *config.Config,
	rp *repository.InvitationCodesRepository,
	enrollmentsRp *repository.EnrollmentsRepository,
	txManager *repository.TransactionManager,
	authService *AuthService,
) *InvitationCodesService {
	return &InvitationCodesService{
		cfg:           cfg,
		rp:            rp,
		enrollmentsRp: enrollmentsRp,
		txManager:     txManager,
		authService:   authService,
		codeTTL:       30 * 24 * time.Hour,
	}
}

func (s *InvitationCodesService) Generate(
	ctx context.Context,
	courseId uuid.UUID,
	createdBy uuid.UUID,
) (*domain.CourseInvitationCode, error) {
	if courseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidInvitationCode)
	}
	if createdBy == uuid.Nil {
		return nil, fmt.Errorf("%w: created_by is empty", ErrInvalidInvitationCode)
	}

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		code, err := randomInvitationCode()
		if err != nil {
			return nil, err
		}

		result, err := s.rp.Create(ctx, domain.CreateInvitationCodeInput{
			CourseId:  courseId,
			Code:      code,
			CreatedBy: createdBy,
			ExpiresAt: time.Now().Add(s.codeTTL),
		})
		if err == nil {
			return result, nil
		}
		lastErr = err
	}

	return nil, lastErr
}

func (s *InvitationCodesService) ListByCourse(
	ctx context.Context,
	courseId uuid.UUID,
) ([]domain.CourseInvitationCode, error) {
	if courseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidInvitationCode)
	}

	return s.rp.ListByCourse(ctx, courseId)
}

func (s *InvitationCodesService) RegisterWithCode(
	ctx context.Context,
	input domain.RegisterWithInvitationCodeInput,
) (*AuthResult, error) {
	input.Code = strings.TrimSpace(input.Code)
	if input.CourseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidInvitationCode)
	}
	if input.Code == "" {
		return nil, fmt.Errorf("%w: code is empty", ErrInvalidInvitationCode)
	}

	var result *AuthResult
	err := s.txManager.WithTransaction(ctx, func(txCtx context.Context) error {
		invitationCode, err := s.rp.GetActiveByCodeForUpdate(txCtx, input.CourseId, input.Code)
		if err != nil {
			return err
		}
		if invitationCode == nil {
			return fmt.Errorf("%w: code is expired, used, or not found", ErrInvalidInvitationCode)
		}

		authResult, err := s.authService.RegisterWithPassword(txCtx, RegisterWithPasswordInput{
			Email:    input.Email,
			Password: input.Password,
			FullName: input.FullName,
		})
		if err != nil {
			return err
		}

		if _, err := s.enrollmentsRp.GrantApprovedAccess(txCtx, domain.CreateCourseEnrollmentInput{
			CourseId: input.CourseId,
			UserId:   authResult.User.Id,
		}); err != nil {
			return err
		}

		usedCode, err := s.rp.MarkUsed(txCtx, invitationCode.Id, authResult.User.Id)
		if err != nil {
			return err
		}
		if usedCode == nil {
			return fmt.Errorf("%w: code was already used", ErrInvalidInvitationCode)
		}

		result = authResult
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func randomInvitationCode() (string, error) {
	buffer := make([]byte, 18)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(buffer), nil
}
