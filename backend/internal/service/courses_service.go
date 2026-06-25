package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"speaker_course/internal/domain"
	"speaker_course/internal/repository"

	"github.com/google/uuid"
)

var ErrInvalidCourse = errors.New("invalid course")

type CoursesService struct {
	rp        *repository.CoursesRepository
	txManager *repository.TransactionManager
}

func NewCoursesService(rp *repository.CoursesRepository, txManager *repository.TransactionManager) *CoursesService {
	return &CoursesService{rp: rp, txManager: txManager}
}

func (s *CoursesService) CreateCourse(
	ctx context.Context,
	input domain.CreateCourseInput,
) (*domain.Course, error) {
	if input.AuthorId == uuid.Nil {
		return nil, fmt.Errorf("%w: author_id is empty", ErrInvalidCourse)
	}
	if strings.TrimSpace(input.Title) == "" {
		return nil, fmt.Errorf("%w: title is empty", ErrInvalidCourse)
	}
	if strings.TrimSpace(input.Slug) == "" {
		return nil, fmt.Errorf("%w: slug is empty", ErrInvalidCourse)
	}

	input.Title = strings.TrimSpace(input.Title)
	input.Slug = strings.TrimSpace(input.Slug)
	input.Description = strings.TrimSpace(input.Description)

	return s.rp.Create(ctx, input)
}

func (s *CoursesService) GetCourseByID(ctx context.Context, id uuid.UUID) (*domain.Course, error) {
	if id == uuid.Nil {
		return nil, fmt.Errorf("%w: id is empty", ErrInvalidCourse)
	}

	return s.rp.GetByID(ctx, id)
}

func (s *CoursesService) GetCourseBySlug(ctx context.Context, slug string) (*domain.Course, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return nil, fmt.Errorf("%w: slug is empty", ErrInvalidCourse)
	}

	return s.rp.GetBySlug(ctx, slug)
}

func (s *CoursesService) GetPrimaryCourse(ctx context.Context) (*domain.Course, error) {
	return s.rp.GetPrimary(ctx)
}

func (s *CoursesService) UpdateCourse(ctx context.Context, input domain.UpdateCourseInput) (*domain.Course, error) {
	if input.CourseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidCourse)
	}
	if strings.TrimSpace(input.Title) == "" {
		return nil, fmt.Errorf("%w: title is empty", ErrInvalidCourse)
	}

	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)

	return s.rp.Update(ctx, input)
}

func (s *CoursesService) PublishCourse(ctx context.Context, id uuid.UUID) (*domain.Course, error) {
	if id == uuid.Nil {
		return nil, fmt.Errorf("%w: id is empty", ErrInvalidCourse)
	}

	return s.rp.Publish(ctx, id)
}

func (s *CoursesService) CreateSection(
	ctx context.Context,
	input domain.CreateCourseSectionInput,
) (*domain.CourseSection, error) {
	if input.CourseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidCourse)
	}
	if strings.TrimSpace(input.Title) == "" {
		return nil, fmt.Errorf("%w: section title is empty", ErrInvalidCourse)
	}
	if input.Position <= 0 {
		return nil, fmt.Errorf("%w: section position must be positive", ErrInvalidCourse)
	}

	input.Title = strings.TrimSpace(input.Title)

	return s.rp.CreateSection(ctx, input)
}

func (s *CoursesService) UpdateSection(
	ctx context.Context,
	input domain.UpdateCourseSectionInput,
) (*domain.CourseSection, error) {
	if input.SectionId == uuid.Nil {
		return nil, fmt.Errorf("%w: section_id is empty", ErrInvalidCourse)
	}
	if strings.TrimSpace(input.Title) == "" {
		return nil, fmt.Errorf("%w: section title is empty", ErrInvalidCourse)
	}

	input.Title = strings.TrimSpace(input.Title)

	return s.rp.UpdateSection(ctx, input)
}

func (s *CoursesService) CreateLesson(
	ctx context.Context,
	input domain.CreateLessonInput,
) (*domain.Lesson, error) {
	if input.CourseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidCourse)
	}
	if input.SectionId == uuid.Nil {
		return nil, fmt.Errorf("%w: section_id is empty", ErrInvalidCourse)
	}
	if strings.TrimSpace(input.Title) == "" {
		return nil, fmt.Errorf("%w: lesson title is empty", ErrInvalidCourse)
	}
	if strings.TrimSpace(input.Slug) == "" {
		return nil, fmt.Errorf("%w: lesson slug is empty", ErrInvalidCourse)
	}
	if input.Position <= 0 {
		return nil, fmt.Errorf("%w: lesson position must be positive", ErrInvalidCourse)
	}

	input.Title = strings.TrimSpace(input.Title)
	input.Slug = strings.TrimSpace(input.Slug)

	return s.rp.CreateLesson(ctx, input)
}

func (s *CoursesService) GetLessonByID(ctx context.Context, id uuid.UUID) (*domain.Lesson, error) {
	if id == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidCourse)
	}

	return s.rp.GetLessonByID(ctx, id)
}

func (s *CoursesService) SaveLessonDraft(
	ctx context.Context,
	input domain.UpdateLessonDraftContentInput,
) (*domain.Lesson, error) {
	if input.LessonId == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidCourse)
	}
	if err := validateEditorContent(input.Content); err != nil {
		return nil, err
	}

	return s.rp.UpdateLessonDraftContent(ctx, input)
}

func (s *CoursesService) UpdateLesson(ctx context.Context, input domain.UpdateLessonInput) (*domain.Lesson, error) {
	if input.LessonId == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidCourse)
	}
	if strings.TrimSpace(input.Title) == "" {
		return nil, fmt.Errorf("%w: lesson title is empty", ErrInvalidCourse)
	}
	if strings.TrimSpace(input.Slug) == "" {
		return nil, fmt.Errorf("%w: lesson slug is empty", ErrInvalidCourse)
	}

	input.Title = strings.TrimSpace(input.Title)
	input.Slug = strings.TrimSpace(input.Slug)

	return s.rp.UpdateLesson(ctx, input)
}

func (s *CoursesService) PublishLesson(ctx context.Context, lessonId uuid.UUID) (*domain.Lesson, error) {
	if lessonId == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidCourse)
	}

	return s.rp.PublishLesson(ctx, lessonId)
}

func (s *CoursesService) GetCurriculum(
	ctx context.Context,
	courseId uuid.UUID,
) (*domain.CourseCurriculum, error) {
	if courseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidCourse)
	}

	return s.rp.GetCurriculum(ctx, courseId)
}

func (s *CoursesService) ReorderLessons(
	ctx context.Context,
	courseId uuid.UUID,
	items []domain.ReorderLessonInput,
) (*domain.CourseCurriculum, error) {
	if courseId == uuid.Nil {
		return nil, fmt.Errorf("%w: course_id is empty", ErrInvalidCourse)
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("%w: reorder items are empty", ErrInvalidCourse)
	}

	seenLessons := make(map[uuid.UUID]struct{}, len(items))
	positionsBySection := make(map[uuid.UUID]map[int]struct{})
	for _, item := range items {
		if item.LessonId == uuid.Nil {
			return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidCourse)
		}
		if item.SectionId == uuid.Nil {
			return nil, fmt.Errorf("%w: section_id is empty", ErrInvalidCourse)
		}
		if item.Position <= 0 {
			return nil, fmt.Errorf("%w: lesson position must be positive", ErrInvalidCourse)
		}

		if _, ok := seenLessons[item.LessonId]; ok {
			return nil, fmt.Errorf("%w: duplicate lesson_id", ErrInvalidCourse)
		}
		seenLessons[item.LessonId] = struct{}{}

		if positionsBySection[item.SectionId] == nil {
			positionsBySection[item.SectionId] = make(map[int]struct{})
		}
		if _, ok := positionsBySection[item.SectionId][item.Position]; ok {
			return nil, fmt.Errorf("%w: duplicate position in section", ErrInvalidCourse)
		}
		positionsBySection[item.SectionId][item.Position] = struct{}{}
	}

	if err := s.txManager.WithTransaction(ctx, func(ctx context.Context) error {
		return s.rp.ReorderLessons(ctx, courseId, items)
	}); err != nil {
		return nil, err
	}

	return s.rp.GetCurriculum(ctx, courseId)
}

func validateEditorContent(content json.RawMessage) error {
	if len(content) == 0 {
		return fmt.Errorf("%w: editor content is empty", ErrInvalidCourse)
	}
	if !json.Valid(content) {
		return fmt.Errorf("%w: editor content is not valid json", ErrInvalidCourse)
	}

	var payload map[string]any
	if err := json.Unmarshal(content, &payload); err != nil {
		return fmt.Errorf("%w: editor content must be a json object", ErrInvalidCourse)
	}

	blocks, ok := payload["blocks"]
	if !ok {
		return fmt.Errorf("%w: editor content must contain blocks", ErrInvalidCourse)
	}

	if _, ok := blocks.([]any); !ok {
		return fmt.Errorf("%w: editor blocks must be an array", ErrInvalidCourse)
	}

	return nil
}
