package domain

import (
	"time"

	"github.com/google/uuid"
)

type LessonProgress struct {
	Id          uuid.UUID  `db:"id" json:"id"`
	LessonId    uuid.UUID  `db:"lesson_id" json:"lesson_id"`
	UserId      uuid.UUID  `db:"user_id" json:"user_id"`
	CompletedAt *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

type UpsertLessonProgressInput struct {
	LessonId    uuid.UUID
	UserId      uuid.UUID
	CompletedAt *time.Time
}
