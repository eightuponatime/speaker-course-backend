package domain

import (
	"time"

	"github.com/google/uuid"
)

type CourseStatus string

const (
	CourseStatusDraft     CourseStatus = "draft"
	CourseStatusPublished CourseStatus = "published"
	CourseStatusArchived  CourseStatus = "archived"
)

type Course struct {
	Id            uuid.UUID    `db:"id" json:"id"`
	AuthorId      uuid.UUID    `db:"author_id" json:"author_id"`
	Title         string       `db:"title" json:"title"`
	Slug          string       `db:"slug" json:"slug"`
	Description   string       `db:"description" json:"description"`
	Status        CourseStatus `db:"status" json:"status"`
	CoverImageURL *string      `db:"cover_image_url" json:"cover_image_url,omitempty"`
	CreatedAt     time.Time    `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time    `db:"updated_at" json:"updated_at"`
	PublishedAt   *time.Time   `db:"published_at" json:"published_at,omitempty"`
}

type CourseSection struct {
	Id        uuid.UUID `db:"id" json:"id"`
	CourseId  uuid.UUID `db:"course_id" json:"course_id"`
	Title     string    `db:"title" json:"title"`
	Position  int       `db:"position" json:"position"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type CourseSectionWithLessons struct {
	CourseSection
	Lessons []Lesson `json:"lessons"`
}

type CourseCurriculum struct {
	Course                Course                     `json:"course"`
	Sections              []CourseSectionWithLessons `json:"sections"`
	HasUnpublishedChanges bool                       `json:"has_unpublished_changes"`
	Access                *CourseAccessWindow        `json:"access,omitempty"`
}

type CreateCourseInput struct {
	AuthorId      uuid.UUID
	Title         string
	Slug          string
	Description   string
	CoverImageURL *string
}

type UpdateCourseInput struct {
	CourseId    uuid.UUID
	Title       string
	Description string
}

type CreateCourseSectionInput struct {
	CourseId uuid.UUID
	Title    string
	Position int
}

type UpdateCourseSectionInput struct {
	SectionId uuid.UUID
	Title     string
}
