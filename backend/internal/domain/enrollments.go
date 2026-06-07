package domain

import (
	"time"

	"github.com/google/uuid"
)

type CourseEnrollmentStatus string

const (
	CourseEnrollmentStatusPending  CourseEnrollmentStatus = "pending"
	CourseEnrollmentStatusApproved CourseEnrollmentStatus = "approved"
	CourseEnrollmentStatusRejected CourseEnrollmentStatus = "rejected"
	CourseEnrollmentStatusRevoked  CourseEnrollmentStatus = "revoked"
)

type CourseEnrollment struct {
	Id          uuid.UUID              `db:"id" json:"id"`
	CourseId    uuid.UUID              `db:"course_id" json:"course_id"`
	UserId      uuid.UUID              `db:"user_id" json:"user_id"`
	Status      CourseEnrollmentStatus `db:"status" json:"status"`
	RequestedAt time.Time              `db:"requested_at" json:"requested_at"`
	ReviewedAt  *time.Time             `db:"reviewed_at" json:"reviewed_at,omitempty"`
	ReviewedBy  *uuid.UUID             `db:"reviewed_by" json:"reviewed_by,omitempty"`
	AdminNote   *string                `db:"admin_note" json:"admin_note,omitempty"`
}

type CourseEnrollmentWithUser struct {
	CourseEnrollment
	UserEmail    string  `db:"user_email" json:"user_email"`
	UserFullName *string `db:"user_full_name" json:"user_full_name,omitempty"`
}

type CreateCourseEnrollmentInput struct {
	CourseId uuid.UUID
	UserId   uuid.UUID
}

type ReviewCourseEnrollmentInput struct {
	EnrollmentId uuid.UUID
	Status       CourseEnrollmentStatus
	ReviewedBy   uuid.UUID
	AdminNote    *string
}
