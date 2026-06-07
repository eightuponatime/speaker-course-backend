package service

import (
	"context"
	"errors"
	"fmt"

	"speaker_course/internal/domain"
	"speaker_course/internal/repository"

	"github.com/google/uuid"
)

var ErrInvalidEnrollment = errors.New("invalid enrollment")

type EnrollmentsService struct {
	rp *repository.EnrollmentsRepository
}

func NewEnrollmentsService(rp *repository.EnrollmentsRepository) *EnrollmentsService {
	return &EnrollmentsService{rp: rp}
}

func (s *EnrollmentsService) RequestAccess(
	ctx context.Context,
	input domain.CreateCourseEnrollmentInput,
) (*domain.CourseEnrollment, error) {
	if input.CourseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidEnrollment)
	}
	if input.UserId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidEnrollment)
	}

	existing, err := s.rp.GetByCourseAndUser(ctx, input.CourseId, input.UserId)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	return s.rp.CreateRequest(ctx, input)
}

func (s *EnrollmentsService) GetByCourseAndUser(
	ctx context.Context,
	courseId uuid.UUID,
	userId uuid.UUID,
) (*domain.CourseEnrollment, error) {
	if courseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidEnrollment)
	}
	if userId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidEnrollment)
	}

	return s.rp.GetByCourseAndUser(ctx, courseId, userId)
}

func (s *EnrollmentsService) GetByID(
	ctx context.Context,
	id uuid.UUID,
) (*domain.CourseEnrollment, error) {
	if id == uuid.Nil {
		return nil, fmt.Errorf("%w: enrollment_id is empty", ErrInvalidEnrollment)
	}

	return s.rp.GetByID(ctx, id)
}

func (s *EnrollmentsService) ListByCourseAndStatus(
	ctx context.Context,
	courseId uuid.UUID,
	status domain.CourseEnrollmentStatus,
) ([]domain.CourseEnrollmentWithUser, error) {
	if courseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidEnrollment)
	}
	if !isEnrollmentStatus(status) {
		return nil, fmt.Errorf("%w: unsupported status %q", ErrInvalidEnrollment, status)
	}

	return s.rp.ListByCourseAndStatus(ctx, courseId, status)
}

func (s *EnrollmentsService) Review(
	ctx context.Context,
	input domain.ReviewCourseEnrollmentInput,
) (*domain.CourseEnrollment, error) {
	if input.EnrollmentId == uuid.Nil {
		return nil, fmt.Errorf("%w: enrollment_id is empty", ErrInvalidEnrollment)
	}
	if input.ReviewedBy == uuid.Nil {
		return nil, fmt.Errorf("%w: reviewed_by is empty", ErrInvalidEnrollment)
	}
	if !isReviewStatus(input.Status) {
		return nil, fmt.Errorf("%w: unsupported review status %q", ErrInvalidEnrollment, input.Status)
	}

	return s.rp.Review(ctx, input)
}

func (s *EnrollmentsService) HasApprovedAccess(
	ctx context.Context,
	courseId uuid.UUID,
	userId uuid.UUID,
) (bool, error) {
	if courseId == uuid.Nil {
		return false, fmt.Errorf("%w: course_id is empty", ErrInvalidEnrollment)
	}
	if userId == uuid.Nil {
		return false, fmt.Errorf("%w: user_id is empty", ErrInvalidEnrollment)
	}

	return s.rp.HasApprovedAccess(ctx, courseId, userId)
}

func isEnrollmentStatus(status domain.CourseEnrollmentStatus) bool {
	switch status {
	case domain.CourseEnrollmentStatusPending,
		domain.CourseEnrollmentStatusApproved,
		domain.CourseEnrollmentStatusRejected,
		domain.CourseEnrollmentStatusRevoked:
		return true
	default:
		return false
	}
}

func isReviewStatus(status domain.CourseEnrollmentStatus) bool {
	switch status {
	case domain.CourseEnrollmentStatusApproved,
		domain.CourseEnrollmentStatusRejected,
		domain.CourseEnrollmentStatusRevoked:
		return true
	default:
		return false
	}
}
