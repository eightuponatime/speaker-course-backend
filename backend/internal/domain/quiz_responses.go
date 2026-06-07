package domain

import (
	"time"

	"github.com/google/uuid"
)

type LessonQuizResponse struct {
	Id                  uuid.UUID `db:"id" json:"id"`
	LessonId            uuid.UUID `db:"lesson_id" json:"lesson_id"`
	UserId              uuid.UUID `db:"user_id" json:"user_id"`
	QuizId              string    `db:"quiz_id" json:"quiz_id"`
	SelectedOptionIndex int       `db:"selected_option_index" json:"selected_option_index"`
	CreatedAt           time.Time `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time `db:"updated_at" json:"updated_at"`
}

type LessonQuizResponseWithUser struct {
	LessonQuizResponse
	UserEmail    string  `db:"user_email" json:"user_email"`
	UserFullName *string `db:"user_full_name" json:"user_full_name,omitempty"`
}

type SaveLessonQuizResponseInput struct {
	LessonId            uuid.UUID
	UserId              uuid.UUID
	QuizId              string
	SelectedOptionIndex int
}
