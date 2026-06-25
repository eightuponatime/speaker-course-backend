package domain

import (
	"time"

	"github.com/google/uuid"
)

type LessonProgress struct {
	Id            uuid.UUID  `db:"id" json:"id"`
	LessonId      uuid.UUID  `db:"lesson_id" json:"lesson_id"`
	UserId        uuid.UUID  `db:"user_id" json:"user_id"`
	FirstViewedAt time.Time  `db:"first_viewed_at" json:"first_viewed_at"`
	CompletedAt   *time.Time `db:"completed_at" json:"completed_at,omitempty"`
	UpdatedAt     time.Time  `db:"updated_at" json:"updated_at"`
}

type UpsertLessonProgressInput struct {
	LessonId    uuid.UUID
	UserId      uuid.UUID
	CompletedAt *time.Time
}

type CourseStudentActivity struct {
	CourseId            uuid.UUID  `db:"course_id" json:"course_id"`
	UserId              uuid.UUID  `db:"user_id" json:"user_id"`
	CurrentLessonId     *uuid.UUID `db:"current_lesson_id" json:"current_lesson_id,omitempty"`
	LastSeenAt          *time.Time `db:"last_seen_at" json:"last_seen_at,omitempty"`
	OnlineUntil         *time.Time `db:"online_until" json:"online_until,omitempty"`
	IsOnline            bool       `db:"is_online" json:"is_online"`
	FirstAccessAt       *time.Time `db:"first_access_at" json:"first_access_at,omitempty"`
	AccessExpiresAt     *time.Time `db:"access_expires_at" json:"access_expires_at,omitempty"`
	IsAccessExpired     bool       `db:"is_access_expired" json:"is_access_expired"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time  `db:"updated_at" json:"updated_at"`
	UserEmail           string     `db:"user_email" json:"user_email"`
	UserFullName        *string    `db:"user_full_name" json:"user_full_name,omitempty"`
	CurrentLessonTitle  *string    `db:"current_lesson_title" json:"current_lesson_title,omitempty"`
	CurrentSectionId    *uuid.UUID `db:"current_section_id" json:"current_section_id,omitempty"`
	CurrentSectionTitle *string    `db:"current_section_title" json:"current_section_title,omitempty"`
	LastLoginAt         *time.Time `db:"last_login_at" json:"last_login_at,omitempty"`
	ViewedLessons       int        `db:"viewed_lessons" json:"viewed_lessons"`
	TotalLessons        int        `db:"total_lessons" json:"total_lessons"`
}

type TrackCourseActivityInput struct {
	CourseId uuid.UUID
	UserId   uuid.UUID
	LessonId uuid.UUID
}

type MarkCourseActivityOfflineInput struct {
	CourseId uuid.UUID
	UserId   uuid.UUID
}

type ExtendCourseAccessInput struct {
	CourseId        uuid.UUID
	UserId          uuid.UUID
	AccessExpiresAt time.Time
}

type CourseAccessWindow struct {
	CourseId        uuid.UUID  `db:"course_id" json:"course_id"`
	UserId          uuid.UUID  `db:"user_id" json:"user_id"`
	FirstAccessAt   *time.Time `db:"first_access_at" json:"first_access_at,omitempty"`
	AccessExpiresAt *time.Time `db:"access_expires_at" json:"access_expires_at,omitempty"`
	IsExpired       bool       `db:"is_expired" json:"is_expired"`
}

type LessonProgressHistoryItem struct {
	LessonId        uuid.UUID  `db:"lesson_id" json:"lesson_id"`
	LessonTitle     string     `db:"lesson_title" json:"lesson_title"`
	LessonPosition  int        `db:"lesson_position" json:"lesson_position"`
	SectionId       uuid.UUID  `db:"section_id" json:"section_id"`
	SectionTitle    string     `db:"section_title" json:"section_title"`
	SectionPosition int        `db:"section_position" json:"section_position"`
	FirstViewedAt   *time.Time `db:"first_viewed_at" json:"first_viewed_at,omitempty"`
	LastAttentionAt *time.Time `db:"last_attention_at" json:"last_attention_at,omitempty"`
}
