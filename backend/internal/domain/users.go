package domain

import (
	"time"

	"github.com/google/uuid"
)

type UserRole string

const (
	UserRoleOwner  UserRole = "owner"
	UserRoleAdmin  UserRole = "admin"
	UserRoleMember UserRole = "member"
)

func (r UserRole) IsAdmin() bool {
	return r == UserRoleOwner || r == UserRoleAdmin
}

type User struct {
	Id        uuid.UUID `db:"id" json:"id"`
	GoogleSub *string   `db:"google_sub" json:"google_sub,omitempty"`
	Email     string    `db:"email" json:"email"`
	Password  *string   `db:"password" json:"-"`
	FullName  string    `db:"full_name" json:"full_name"`
	Role      UserRole  `db:"role" json:"role"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type CreateUserInput struct {
	GoogleSub *string
	Email     string
	Password  *string
	FullName  string
	Role      UserRole
}

type UpdateUserProfileInput struct {
	Email    string
	FullName string
}

type AdminUserWithEnrollment struct {
	Id                 uuid.UUID               `db:"id" json:"id"`
	Email              string                  `db:"email" json:"email"`
	FullName           string                  `db:"full_name" json:"full_name"`
	Role               UserRole                `db:"role" json:"role"`
	CreatedAt          time.Time               `db:"created_at" json:"created_at"`
	AuthProvider       string                  `db:"auth_provider" json:"auth_provider"`
	EnrollmentId       *uuid.UUID              `db:"enrollment_id" json:"enrollment_id,omitempty"`
	EnrollmentStatus   *CourseEnrollmentStatus `db:"enrollment_status" json:"enrollment_status,omitempty"`
	EnrollmentDate     *time.Time              `db:"enrollment_requested_at" json:"enrollment_requested_at,omitempty"`
	EnrollmentReviewed *time.Time              `db:"enrollment_reviewed_at" json:"enrollment_reviewed_at,omitempty"`
}
