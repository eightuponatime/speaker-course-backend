package repository

import (
	"context"
	"database/sql"
	"errors"
	"speaker_course/internal/domain"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type EnrollmentsRepository struct {
	db *sqlx.DB
}

func NewEnrollmentsRepository(db *sqlx.DB) *EnrollmentsRepository {
	return &EnrollmentsRepository{db: db}
}

func (r *EnrollmentsRepository) CreateRequest(
	ctx context.Context,
	input domain.CreateCourseEnrollmentInput,
) (*domain.CourseEnrollment, error) {
	const query = `
		insert into course_enrollments (course_id, user_id)
		values ($1, $2)
		returning id, course_id, user_id, status, requested_at, reviewed_at, reviewed_by, admin_note
	`

	q := extractTransaction(ctx, r.db)
	var enrollment domain.CourseEnrollment
	if err := sqlx.GetContext(ctx, q, &enrollment, query, input.CourseId, input.UserId); err != nil {
		return nil, err
	}

	return &enrollment, nil
}

func (r *EnrollmentsRepository) GrantApprovedAccess(
	ctx context.Context,
	input domain.CreateCourseEnrollmentInput,
) (*domain.CourseEnrollment, error) {
	const query = `
		insert into course_enrollments (course_id, user_id, status, reviewed_at, admin_note)
		values ($1, $2, 'approved', now(), 'Access granted by invitation code.')
		on conflict (course_id, user_id) do update
		set status = 'approved',
			reviewed_at = now(),
			reviewed_by = null,
			admin_note = 'Access granted by invitation code.'
		returning id, course_id, user_id, status, requested_at, reviewed_at, reviewed_by, admin_note
	`

	q := extractTransaction(ctx, r.db)
	var enrollment domain.CourseEnrollment
	if err := sqlx.GetContext(ctx, q, &enrollment, query, input.CourseId, input.UserId); err != nil {
		return nil, err
	}

	return &enrollment, nil
}

func (r *EnrollmentsRepository) GetByCourseAndUser(
	ctx context.Context,
	courseId uuid.UUID,
	userId uuid.UUID,
) (*domain.CourseEnrollment, error) {
	const query = `
		select id, course_id, user_id, status, requested_at, reviewed_at, reviewed_by, admin_note
		from course_enrollments
		where course_id = $1
			and user_id = $2
	`

	q := extractTransaction(ctx, r.db)
	var enrollment domain.CourseEnrollment
	if err := sqlx.GetContext(ctx, q, &enrollment, query, courseId, userId); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &enrollment, nil
}

func (r *EnrollmentsRepository) GetByID(
	ctx context.Context,
	id uuid.UUID,
) (*domain.CourseEnrollment, error) {
	const query = `
		select id, course_id, user_id, status, requested_at, reviewed_at, reviewed_by, admin_note
		from course_enrollments
		where id = $1
	`

	q := extractTransaction(ctx, r.db)
	var enrollment domain.CourseEnrollment
	if err := sqlx.GetContext(ctx, q, &enrollment, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &enrollment, nil
}

func (r *EnrollmentsRepository) ListByCourseAndStatus(
	ctx context.Context,
	courseId uuid.UUID,
	status domain.CourseEnrollmentStatus,
) ([]domain.CourseEnrollmentWithUser, error) {
	const query = `
		select e.id,
			e.course_id,
			e.user_id,
			e.status,
			e.requested_at,
			e.reviewed_at,
			e.reviewed_by,
			e.admin_note,
			u.email as user_email,
			u.full_name as user_full_name
		from course_enrollments e
		join users u on u.id = e.user_id
		where e.course_id = $1
			and e.status = $2
		order by e.requested_at desc
	`

	q := extractTransaction(ctx, r.db)
	enrollments := make([]domain.CourseEnrollmentWithUser, 0)
	if err := sqlx.SelectContext(ctx, q, &enrollments, query, courseId, status); err != nil {
		return nil, err
	}

	return enrollments, nil
}

func (r *EnrollmentsRepository) Review(
	ctx context.Context,
	input domain.ReviewCourseEnrollmentInput,
) (*domain.CourseEnrollment, error) {
	const query = `
		update course_enrollments
		set status = $2,
			reviewed_at = now(),
			reviewed_by = $3,
			admin_note = $4
		where id = $1
		returning id, course_id, user_id, status, requested_at, reviewed_at, reviewed_by, admin_note
	`

	q := extractTransaction(ctx, r.db)
	var enrollment domain.CourseEnrollment
	if err := sqlx.GetContext(
		ctx,
		q,
		&enrollment,
		query,
		input.EnrollmentId,
		input.Status,
		input.ReviewedBy,
		input.AdminNote,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &enrollment, nil
}

func (r *EnrollmentsRepository) HasApprovedAccess(
	ctx context.Context,
	courseId uuid.UUID,
	userId uuid.UUID,
) (bool, error) {
	const query = `
		select exists (
			select 1
			from course_enrollments
			where course_id = $1
				and user_id = $2
				and status = 'approved'
		)
	`

	q := extractTransaction(ctx, r.db)
	var hasAccess bool
	if err := sqlx.GetContext(ctx, q, &hasAccess, query, courseId, userId); err != nil {
		return false, err
	}

	return hasAccess, nil
}

func (r *EnrollmentsRepository) DeleteByCourseAndUser(
	ctx context.Context,
	courseId uuid.UUID,
	userId uuid.UUID,
) error {
	const query = `
		delete from course_enrollments
		where course_id = $1
			and user_id = $2
	`

	q := extractTransaction(ctx, r.db)
	_, err := q.ExecContext(ctx, query, courseId, userId)
	return err
}
