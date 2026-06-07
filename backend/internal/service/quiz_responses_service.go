package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"speaker_course/internal/domain"
	"speaker_course/internal/repository"

	"github.com/google/uuid"
)

var ErrInvalidQuizResponse = errors.New("invalid quiz response")

type QuizResponsesService struct {
	rp *repository.QuizResponsesRepository
}

func NewQuizResponsesService(rp *repository.QuizResponsesRepository) *QuizResponsesService {
	return &QuizResponsesService{rp: rp}
}

func (s *QuizResponsesService) Save(
	ctx context.Context,
	input domain.SaveLessonQuizResponseInput,
) (*domain.LessonQuizResponse, error) {
	if input.LessonId == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidQuizResponse)
	}
	if input.UserId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidQuizResponse)
	}
	input.QuizId = strings.TrimSpace(input.QuizId)
	if input.QuizId == "" {
		return nil, fmt.Errorf("%w: quiz_id is empty", ErrInvalidQuizResponse)
	}
	if input.SelectedOptionIndex < 0 {
		return nil, fmt.Errorf("%w: selected option index is invalid", ErrInvalidQuizResponse)
	}

	return s.rp.Save(ctx, input)
}

func (s *QuizResponsesService) ListByLessonAndUser(
	ctx context.Context,
	lessonId uuid.UUID,
	userId uuid.UUID,
) ([]domain.LessonQuizResponse, error) {
	if lessonId == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidQuizResponse)
	}
	if userId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidQuizResponse)
	}

	return s.rp.ListByLessonAndUser(ctx, lessonId, userId)
}

func (s *QuizResponsesService) ListByLesson(
	ctx context.Context,
	lessonId uuid.UUID,
) ([]domain.LessonQuizResponseWithUser, error) {
	if lessonId == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidQuizResponse)
	}

	return s.rp.ListByLesson(ctx, lessonId)
}
