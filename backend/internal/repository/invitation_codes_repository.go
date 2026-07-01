package repository

import (
	"context"
	"database/sql"
	"errors"
	"speaker_course/internal/domain"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type InvitationCodesRepository struct {
	db *sqlx.DB
}

func NewInvitationCodesRepository(db *sqlx.DB) *InvitationCodesRepository {
	return &InvitationCodesRepository{db: db}
}

func (r *InvitationCodesRepository) Create(
	ctx context.Context,
	input domain.CreateInvitationCodeInput,
) (*domain.CourseInvitationCode, error) {
	const query = `
		insert into course_invitation_codes (course_id, code, created_by, expires_at)
		values ($1, $2, $3, $4)
		returning id,
			course_id,
			code,
			case
				when used_at is not null then 'used'
				when expires_at <= now() then 'expired'
				else 'active'
			end as status,
			created_by,
			used_by,
			created_at,
			expires_at,
			used_at
	`

	q := extractTransaction(ctx, r.db)
	var code domain.CourseInvitationCode
	if err := sqlx.GetContext(ctx, q, &code, query, input.CourseId, input.Code, input.CreatedBy, input.ExpiresAt); err != nil {
		return nil, err
	}

	return &code, nil
}

func (r *InvitationCodesRepository) ListByCourse(
	ctx context.Context,
	courseId uuid.UUID,
) ([]domain.CourseInvitationCode, error) {
	const query = `
		select id,
			course_id,
			code,
			case
				when used_at is not null then 'used'
				when expires_at <= now() then 'expired'
				else 'active'
			end as status,
			created_by,
			used_by,
			created_at,
			expires_at,
			used_at
		from course_invitation_codes
		where course_id = $1
		order by created_at desc
	`

	q := extractTransaction(ctx, r.db)
	codes := make([]domain.CourseInvitationCode, 0)
	if err := sqlx.SelectContext(ctx, q, &codes, query, courseId); err != nil {
		return nil, err
	}

	return codes, nil
}

func (r *InvitationCodesRepository) GetActiveByCodeForUpdate(
	ctx context.Context,
	courseId uuid.UUID,
	codeValue string,
) (*domain.CourseInvitationCode, error) {
	const query = `
		select id,
			course_id,
			code,
			case
				when used_at is not null then 'used'
				when expires_at <= now() then 'expired'
				else 'active'
			end as status,
			created_by,
			used_by,
			created_at,
			expires_at,
			used_at
		from course_invitation_codes
		where course_id = $1
			and code = $2
			and used_at is null
			and expires_at > now()
		for update
	`

	q := extractTransaction(ctx, r.db)
	var code domain.CourseInvitationCode
	if err := sqlx.GetContext(ctx, q, &code, query, courseId, codeValue); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &code, nil
}

func (r *InvitationCodesRepository) MarkUsed(
	ctx context.Context,
	id uuid.UUID,
	userId uuid.UUID,
) (*domain.CourseInvitationCode, error) {
	const query = `
		update course_invitation_codes
		set used_by = $2,
			used_at = now()
		where id = $1
			and used_at is null
		returning id,
			course_id,
			code,
			'used' as status,
			created_by,
			used_by,
			created_at,
			expires_at,
			used_at
	`

	q := extractTransaction(ctx, r.db)
	var code domain.CourseInvitationCode
	if err := sqlx.GetContext(ctx, q, &code, query, id, userId); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &code, nil
}
