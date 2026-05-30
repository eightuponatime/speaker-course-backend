package repository

import (
	"context"
	"database/sql"
	"errors"
	"speaker_course/internal/domain"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type CoursesRepository struct {
	db *sqlx.DB
}

func NewCoursesRepository(db *sqlx.DB) *CoursesRepository {
	return &CoursesRepository{db: db}
}

func (r *CoursesRepository) Create(ctx context.Context, input domain.CreateCourseInput) (*domain.Course, error) {
	const query = `
		insert into courses (author_id, title, slug, description, cover_image_url)
		values ($1, $2, $3, $4, $5)
		returning id, author_id, title, slug, description, status, cover_image_url,
			created_at, updated_at, published_at
	`

	q := extractTransaction(ctx, r.db)
	var course domain.Course
	if err := sqlx.GetContext(
		ctx,
		q,
		&course,
		query,
		input.AuthorId,
		input.Title,
		input.Slug,
		input.Description,
		input.CoverImageURL,
	); err != nil {
		return nil, err
	}

	return &course, nil
}

func (r *CoursesRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Course, error) {
	const query = `
		select id, author_id, title, slug, description, status, cover_image_url,
			created_at, updated_at, published_at
		from courses
		where id = $1
	`

	q := extractTransaction(ctx, r.db)
	var course domain.Course
	if err := sqlx.GetContext(ctx, q, &course, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &course, nil
}

func (r *CoursesRepository) GetBySlug(ctx context.Context, slug string) (*domain.Course, error) {
	const query = `
		select id, author_id, title, slug, description, status, cover_image_url,
			created_at, updated_at, published_at
		from courses
		where slug = $1
	`

	q := extractTransaction(ctx, r.db)
	var course domain.Course
	if err := sqlx.GetContext(ctx, q, &course, query, slug); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &course, nil
}

func (r *CoursesRepository) Publish(ctx context.Context, id uuid.UUID) (*domain.Course, error) {
	const query = `
		update courses
		set status = 'published',
			published_at = coalesce(published_at, now()),
			updated_at = now()
		where id = $1
		returning id, author_id, title, slug, description, status, cover_image_url,
			created_at, updated_at, published_at
	`

	q := extractTransaction(ctx, r.db)
	var course domain.Course
	if err := sqlx.GetContext(ctx, q, &course, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &course, nil
}

func (r *CoursesRepository) CreateSection(
	ctx context.Context,
	input domain.CreateCourseSectionInput,
) (*domain.CourseSection, error) {
	const query = `
		insert into course_sections (course_id, title, position)
		values ($1, $2, $3)
		returning id, course_id, title, position, created_at, updated_at
	`

	q := extractTransaction(ctx, r.db)
	var section domain.CourseSection
	if err := sqlx.GetContext(ctx, q, &section, query, input.CourseId, input.Title, input.Position); err != nil {
		return nil, err
	}

	return &section, nil
}

func (r *CoursesRepository) CreateLesson(ctx context.Context, input domain.CreateLessonInput) (*domain.Lesson, error) {
	const query = `
		insert into lessons (course_id, section_id, title, slug, position)
		values ($1, $2, $3, $4, $5)
		returning id, course_id, section_id, title, slug, position, status,
			draft_content, published_content, created_at, updated_at, published_at
	`

	q := extractTransaction(ctx, r.db)
	var lesson domain.Lesson
	if err := sqlx.GetContext(
		ctx,
		q,
		&lesson,
		query,
		input.CourseId,
		input.SectionId,
		input.Title,
		input.Slug,
		input.Position,
	); err != nil {
		return nil, err
	}

	return &lesson, nil
}

func (r *CoursesRepository) GetLessonByID(ctx context.Context, id uuid.UUID) (*domain.Lesson, error) {
	const query = `
		select id, course_id, section_id, title, slug, position, status,
			draft_content, published_content, created_at, updated_at, published_at
		from lessons
		where id = $1
	`

	q := extractTransaction(ctx, r.db)
	var lesson domain.Lesson
	if err := sqlx.GetContext(ctx, q, &lesson, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &lesson, nil
}

func (r *CoursesRepository) UpdateLessonDraftContent(
	ctx context.Context,
	input domain.UpdateLessonDraftContentInput,
) (*domain.Lesson, error) {
	const query = `
		update lessons
		set draft_content = $2,
			updated_at = now()
		where id = $1
		returning id, course_id, section_id, title, slug, position, status,
			draft_content, published_content, created_at, updated_at, published_at
	`

	q := extractTransaction(ctx, r.db)
	var lesson domain.Lesson
	if err := sqlx.GetContext(ctx, q, &lesson, query, input.LessonId, input.Content); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &lesson, nil
}

func (r *CoursesRepository) PublishLesson(ctx context.Context, lessonId uuid.UUID) (*domain.Lesson, error) {
	const query = `
		update lessons
		set published_content = draft_content,
			status = 'published',
			published_at = coalesce(published_at, now()),
			updated_at = now()
		where id = $1
		returning id, course_id, section_id, title, slug, position, status,
			draft_content, published_content, created_at, updated_at, published_at
	`

	q := extractTransaction(ctx, r.db)
	var lesson domain.Lesson
	if err := sqlx.GetContext(ctx, q, &lesson, query, lessonId); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &lesson, nil
}

func (r *CoursesRepository) GetCurriculum(ctx context.Context, courseId uuid.UUID) (*domain.CourseCurriculum, error) {
	course, err := r.GetByID(ctx, courseId)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, nil
	}

	const sectionsQuery = `
		select id, course_id, title, position, created_at, updated_at
		from course_sections
		where course_id = $1
		order by position
	`

	const lessonsQuery = `
		select id, course_id, section_id, title, slug, position, status,
			draft_content, published_content, created_at, updated_at, published_at
		from lessons
		where course_id = $1
		order by section_id, position
	`

	q := extractTransaction(ctx, r.db)

	var sections []domain.CourseSection
	if err := sqlx.SelectContext(ctx, q, &sections, sectionsQuery, courseId); err != nil {
		return nil, err
	}

	var lessons []domain.Lesson
	if err := sqlx.SelectContext(ctx, q, &lessons, lessonsQuery, courseId); err != nil {
		return nil, err
	}

	lessonsBySection := make(map[uuid.UUID][]domain.Lesson, len(sections))
	for _, lesson := range lessons {
		lessonsBySection[lesson.SectionId] = append(lessonsBySection[lesson.SectionId], lesson)
	}

	curriculum := &domain.CourseCurriculum{
		Course:   *course,
		Sections: make([]domain.CourseSectionWithLessons, 0, len(sections)),
	}
	for _, section := range sections {
		curriculum.Sections = append(curriculum.Sections, domain.CourseSectionWithLessons{
			CourseSection: section,
			Lessons:       lessonsBySection[section.Id],
		})
	}

	return curriculum, nil
}
