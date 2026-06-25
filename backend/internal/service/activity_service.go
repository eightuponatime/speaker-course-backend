package service

import (
	"context"
	"errors"
	"fmt"
	"speaker_course/internal/domain"
	"speaker_course/internal/repository"

	"github.com/google/uuid"
)

var ErrInvalidActivity = errors.New("invalid activity")

type ActivityService struct {
	rp *repository.ActivityRepository
}

func NewActivityService(rp *repository.ActivityRepository) *ActivityService {
	return &ActivityService{rp: rp}
}

func (s *ActivityService) TrackCourseActivity(
	ctx context.Context,
	input domain.TrackCourseActivityInput,
) (*domain.CourseStudentActivity, error) {
	if input.CourseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidActivity)
	}
	if input.UserId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidActivity)
	}
	if input.LessonId == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidActivity)
	}

	return s.rp.TrackCourseActivity(ctx, input)
}

func (s *ActivityService) MarkCourseActivityOffline(
	ctx context.Context,
	input domain.MarkCourseActivityOfflineInput,
) error {
	if input.CourseId == uuid.Nil {
		return fmt.Errorf("%w: course_id is empty", ErrInvalidActivity)
	}
	if input.UserId == uuid.Nil {
		return fmt.Errorf("%w: user_id is empty", ErrInvalidActivity)
	}

	return s.rp.MarkCourseActivityOffline(ctx, input)
}

func (s *ActivityService) ExtendCourseAccess(
	ctx context.Context,
	input domain.ExtendCourseAccessInput,
) (*domain.CourseAccessWindow, error) {
	if input.CourseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidActivity)
	}
	if input.UserId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidActivity)
	}
	if input.AccessExpiresAt.IsZero() {
		return nil, fmt.Errorf("%w: access_expires_at is empty", ErrInvalidActivity)
	}

	return s.rp.ExtendCourseAccess(ctx, input)
}

func (s *ActivityService) EnsureCourseAccessStarted(
	ctx context.Context,
	input domain.MarkCourseActivityOfflineInput,
) (*domain.CourseAccessWindow, error) {
	if input.CourseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidActivity)
	}
	if input.UserId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidActivity)
	}

	return s.rp.EnsureCourseAccessStarted(ctx, input)
}

func (s *ActivityService) ListCourseStudentActivity(
	ctx context.Context,
	courseId uuid.UUID,
) ([]domain.CourseStudentActivity, error) {
	if courseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidActivity)
	}

	return s.rp.ListCourseStudentActivity(ctx, courseId.String())
}

func (s *ActivityService) ListLessonProgressHistory(
	ctx context.Context,
	courseId uuid.UUID,
	userId uuid.UUID,
) ([]domain.LessonProgressHistoryItem, error) {
	if courseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidActivity)
	}
	if userId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidActivity)
	}

	return s.rp.ListLessonProgressHistory(ctx, courseId.String(), userId.String())
}
