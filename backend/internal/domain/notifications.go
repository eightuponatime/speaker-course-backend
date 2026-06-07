package domain

import (
	"time"

	"github.com/google/uuid"
)

type NotificationType string

const (
	NotificationCourseEnrollmentRequested NotificationType = "course_enrollment_requested"
	NotificationCourseAccessApproved      NotificationType = "course_access_approved"
	NotificationCourseAccessRejected      NotificationType = "course_access_rejected"
	NotificationCourseAccessRevoked       NotificationType = "course_access_revoked"
	NotificationCourseAccessRestored      NotificationType = "course_access_restored"
)

type Notification struct {
	Id           uuid.UUID        `db:"id" json:"id"`
	UserId       uuid.UUID        `db:"user_id" json:"user_id"`
	ActorId      *uuid.UUID       `db:"actor_id" json:"actor_id,omitempty"`
	CourseId     *uuid.UUID       `db:"course_id" json:"course_id,omitempty"`
	EnrollmentId *uuid.UUID       `db:"enrollment_id" json:"enrollment_id,omitempty"`
	Type         NotificationType `db:"type" json:"type"`
	Title        string           `db:"title" json:"title"`
	Body         string           `db:"body" json:"body"`
	ReadAt       *time.Time       `db:"read_at" json:"read_at,omitempty"`
	DeletedAt    *time.Time       `db:"deleted_at" json:"deleted_at,omitempty"`
	CreatedAt    time.Time        `db:"created_at" json:"created_at"`
}

type CreateNotificationInput struct {
	UserId       uuid.UUID
	ActorId      *uuid.UUID
	CourseId     *uuid.UUID
	EnrollmentId *uuid.UUID
	Type         NotificationType
	Title        string
	Body         string
}
