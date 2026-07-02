package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type LessonSubmissionStatus string

const (
	LessonSubmissionStatusPending       LessonSubmissionStatus = "pending"
	LessonSubmissionStatusAccepted      LessonSubmissionStatus = "accepted"
	LessonSubmissionStatusNeedsRevision LessonSubmissionStatus = "needs_revision"
)

type SubmissionAttachment struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	URL       string `json:"url"`
	MimeType  string `json:"mime_type,omitempty"`
	SizeBytes int64  `json:"size_bytes,omitempty"`
}

type LessonSubmission struct {
	Id                uuid.UUID              `db:"id" json:"id"`
	LessonId          uuid.UUID              `db:"lesson_id" json:"lesson_id"`
	CourseId          uuid.UUID              `db:"course_id" json:"course_id"`
	UserId            uuid.UUID              `db:"user_id" json:"user_id"`
	Status            LessonSubmissionStatus `db:"status" json:"status"`
	Body              string                 `db:"body" json:"body"`
	Attachments       json.RawMessage        `db:"attachments" json:"attachments"`
	ViewedByAdminAt   *time.Time             `db:"viewed_by_admin_at" json:"viewed_by_admin_at,omitempty"`
	ViewedByStudentAt *time.Time             `db:"viewed_by_student_at" json:"viewed_by_student_at,omitempty"`
	SubmittedAt       time.Time              `db:"submitted_at" json:"submitted_at"`
	ReviewedAt        *time.Time             `db:"reviewed_at" json:"reviewed_at,omitempty"`
	ReviewedBy        *uuid.UUID             `db:"reviewed_by" json:"reviewed_by,omitempty"`
	CreatedAt         time.Time              `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time              `db:"updated_at" json:"updated_at"`
}

type LessonSubmissionComment struct {
	Id           uuid.UUID       `db:"id" json:"id"`
	SubmissionId uuid.UUID       `db:"submission_id" json:"submission_id"`
	AuthorId     uuid.UUID       `db:"author_id" json:"author_id"`
	Body         string          `db:"body" json:"body"`
	Attachments  json.RawMessage `db:"attachments" json:"attachments"`
	CreatedAt    time.Time       `db:"created_at" json:"created_at"`
	AuthorEmail  string          `db:"author_email" json:"author_email"`
	AuthorName   string          `db:"author_full_name" json:"author_full_name"`
	AuthorRole   UserRole        `db:"author_role" json:"author_role"`
}

type LessonSubmissionSummary struct {
	Id                uuid.UUID              `db:"id" json:"id"`
	LessonId          uuid.UUID              `db:"lesson_id" json:"lesson_id"`
	CourseId          uuid.UUID              `db:"course_id" json:"course_id"`
	UserId            uuid.UUID              `db:"user_id" json:"user_id"`
	Status            LessonSubmissionStatus `db:"status" json:"status"`
	UpdatedAt         time.Time              `db:"updated_at" json:"updated_at"`
	ReviewedAt        *time.Time             `db:"reviewed_at" json:"reviewed_at,omitempty"`
	ViewedByAdminAt   *time.Time             `db:"viewed_by_admin_at" json:"viewed_by_admin_at,omitempty"`
	ViewedByStudentAt *time.Time             `db:"viewed_by_student_at" json:"viewed_by_student_at,omitempty"`
	IsUnreadForAdmin  bool                   `db:"is_unread_for_admin" json:"is_unread_for_admin"`
	CommentCount      int                    `db:"comment_count" json:"comment_count"`
}

type AdminLessonSubmissionListItem struct {
	LessonSubmissionSummary
	LessonTitle     string `db:"lesson_title" json:"lesson_title"`
	SectionTitle    string `db:"section_title" json:"section_title"`
	UserEmail       string `db:"user_email" json:"user_email"`
	UserFullName    string `db:"user_full_name" json:"user_full_name"`
	BodyPreview     string `db:"body_preview" json:"body_preview"`
	AttachmentCount int    `db:"attachment_count" json:"attachment_count"`
}

type LessonSubmissionDetail struct {
	Submission LessonSubmission          `json:"submission"`
	Comments   []LessonSubmissionComment `json:"comments"`
}
