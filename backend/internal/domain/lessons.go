package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type LessonStatus string

const (
	LessonStatusDraft     LessonStatus = "draft"
	LessonStatusPublished LessonStatus = "published"
	LessonStatusArchived  LessonStatus = "archived"
)

type Lesson struct {
	Id               uuid.UUID        `db:"id" json:"id"`
	CourseId         uuid.UUID        `db:"course_id" json:"course_id"`
	SectionId        uuid.UUID        `db:"section_id" json:"section_id"`
	Title            string           `db:"title" json:"title"`
	Slug             string           `db:"slug" json:"slug"`
	Position         int              `db:"position" json:"position"`
	Status           LessonStatus     `db:"status" json:"status"`
	DraftContent     json.RawMessage  `db:"draft_content" json:"draft_content"`
	PublishedContent *json.RawMessage `db:"published_content" json:"published_content,omitempty"`
	CreatedAt        time.Time        `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time        `db:"updated_at" json:"updated_at"`
	PublishedAt      *time.Time       `db:"published_at" json:"published_at,omitempty"`
}

type CreateLessonInput struct {
	CourseId  uuid.UUID
	SectionId uuid.UUID
	Title     string
	Slug      string
	Position  int
}

type UpdateLessonDraftContentInput struct {
	LessonId uuid.UUID
	Content  json.RawMessage
}

type UpdateLessonInput struct {
	LessonId uuid.UUID
	Title    string
	Slug     string
}

type ReorderLessonInput struct {
	LessonId  uuid.UUID
	SectionId uuid.UUID
	Position  int
}
