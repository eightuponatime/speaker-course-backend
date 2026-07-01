package domain

import (
	"time"

	"github.com/google/uuid"
)

type InvitationCodeStatus string

const (
	InvitationCodeStatusActive  InvitationCodeStatus = "active"
	InvitationCodeStatusUsed    InvitationCodeStatus = "used"
	InvitationCodeStatusExpired InvitationCodeStatus = "expired"
)

type CourseInvitationCode struct {
	Id        uuid.UUID            `db:"id" json:"id"`
	CourseId  uuid.UUID            `db:"course_id" json:"course_id"`
	Code      string               `db:"code" json:"code"`
	Status    InvitationCodeStatus `db:"status" json:"status"`
	CreatedBy *uuid.UUID           `db:"created_by" json:"created_by,omitempty"`
	UsedBy    *uuid.UUID           `db:"used_by" json:"used_by,omitempty"`
	CreatedAt time.Time            `db:"created_at" json:"created_at"`
	ExpiresAt time.Time            `db:"expires_at" json:"expires_at"`
	UsedAt    *time.Time           `db:"used_at" json:"used_at,omitempty"`
}

type CreateInvitationCodeInput struct {
	CourseId  uuid.UUID
	Code      string
	CreatedBy uuid.UUID
	ExpiresAt time.Time
}

type RegisterWithInvitationCodeInput struct {
	CourseId uuid.UUID
	Code     string
	Email    string
	Password string
	FullName string
}
