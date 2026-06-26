package repository

import (
	"context"
	"database/sql"
	"errors"
	"speaker_course/internal/domain"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type UsersRepository struct {
	db *sqlx.DB
}

func NewUsersRepository(db *sqlx.DB) *UsersRepository {
	return &UsersRepository{db: db}
}

func (r *UsersRepository) Create(ctx context.Context, input domain.CreateUserInput) (*domain.User, error) {
	const query = `
		insert into users (google_sub, email, password, full_name, role)
		values ($1, $2, $3, $4, $5)
		returning id, google_sub, email, password, full_name, role, created_at
	`

	q := extractTransaction(ctx, r.db)
	var user domain.User
	if err := sqlx.GetContext(
		ctx,
		q,
		&user,
		query,
		input.GoogleSub,
		input.Email,
		input.Password,
		input.FullName,
		input.Role,
	); err != nil {
		return nil, err
	}

	return &user, nil
}

func (r *UsersRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	const query = `
		select id, google_sub, email, password, full_name, role, created_at
		from users
		where id = $1
	`

	q := extractTransaction(ctx, r.db)
	var user domain.User
	if err := sqlx.GetContext(ctx, q, &user, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &user, nil
}

func (r *UsersRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	const query = `
		select id, google_sub, email, password, full_name, role, created_at
		from users
		where email = $1
	`

	q := extractTransaction(ctx, r.db)
	var user domain.User
	if err := sqlx.GetContext(ctx, q, &user, query, email); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &user, nil
}

func (r *UsersRepository) GetByGoogleSub(ctx context.Context, googleSub string) (*domain.User, error) {
	const query = `
		select id, google_sub, email, password, full_name, role, created_at
		from users
		where google_sub = $1
	`

	q := extractTransaction(ctx, r.db)
	var user domain.User
	if err := sqlx.GetContext(ctx, q, &user, query, googleSub); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &user, nil
}

func (r *UsersRepository) ListAdmins(ctx context.Context) ([]domain.User, error) {
	const query = `
		select id, google_sub, email, password, full_name, role, created_at
		from users
		where role = 'admin'
		order by created_at asc
	`

	q := extractTransaction(ctx, r.db)
	users := make([]domain.User, 0)
	if err := sqlx.SelectContext(ctx, q, &users, query); err != nil {
		return nil, err
	}

	return users, nil
}

func (r *UsersRepository) ListForAdmin(
	ctx context.Context,
	courseID uuid.UUID,
	search string,
	role string,
	enrollmentStatus string,
) ([]domain.AdminUserWithEnrollment, error) {
	const query = `
		select u.id,
			u.email,
			u.full_name,
			u.role,
			u.created_at,
			case
				when u.google_sub is not null and u.password is not null then 'google_password'
				when u.google_sub is not null then 'google'
				else 'password'
			end as auth_provider,
			e.id as enrollment_id,
			e.status as enrollment_status,
			e.requested_at as enrollment_requested_at,
			e.reviewed_at as enrollment_reviewed_at
		from users u
		left join course_enrollments e on e.user_id = u.id
			and e.course_id = $1
		where ($2 = '' or u.email ilike '%' || $2 || '%' or u.full_name ilike '%' || $2 || '%')
			and ($3 = '' or u.role = $3)
			and ($4 = '' or coalesce(e.status::text, 'none') = $4)
		order by
			case when e.status = 'pending' then 0 else 1 end,
			u.created_at desc
	`

	q := extractTransaction(ctx, r.db)
	users := make([]domain.AdminUserWithEnrollment, 0)
	if err := sqlx.SelectContext(ctx, q, &users, query, courseID, search, role, enrollmentStatus); err != nil {
		return nil, err
	}

	return users, nil
}

func (r *UsersRepository) UpdateRole(ctx context.Context, userID uuid.UUID, role domain.UserRole) (*domain.User, error) {
	const query = `
		update users
		set role = $2
		where id = $1
		returning id, google_sub, email, password, full_name, role, created_at
	`

	q := extractTransaction(ctx, r.db)
	var user domain.User
	if err := sqlx.GetContext(ctx, q, &user, query, userID, role); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &user, nil
}

func (r *UsersRepository) UpdateGoogleSub(
	ctx context.Context,
	userID uuid.UUID,
	googleSub string,
) (*domain.User, error) {
	const query = `
		update users
		set google_sub = $2
		where id = $1
		returning id, google_sub, email, password, full_name, role, created_at
	`

	q := extractTransaction(ctx, r.db)
	var user domain.User
	if err := sqlx.GetContext(ctx, q, &user, query, userID, googleSub); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &user, nil
}

func (r *UsersRepository) UpdateGoogleIdentity(
	ctx context.Context,
	userID uuid.UUID,
	googleSub string,
	email string,
) (*domain.User, error) {
	const query = `
		update users
		set google_sub = $2,
			email = $3
		where id = $1
		returning id, google_sub, email, password, full_name, role, created_at
	`

	q := extractTransaction(ctx, r.db)
	var user domain.User
	if err := sqlx.GetContext(ctx, q, &user, query, userID, googleSub, email); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &user, nil
}

func (r *UsersRepository) UpdateProfile(
	ctx context.Context,
	userID uuid.UUID,
	input domain.UpdateUserProfileInput,
) (*domain.User, error) {
	const query = `
		update users
		set email = $2,
			full_name = $3
		where id = $1
		returning id, google_sub, email, password, full_name, role, created_at
	`

	q := extractTransaction(ctx, r.db)
	var user domain.User
	if err := sqlx.GetContext(ctx, q, &user, query, userID, input.Email, input.FullName); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &user, nil
}

func (r *UsersRepository) UpdatePassword(
	ctx context.Context,
	userID uuid.UUID,
	passwordHash string,
) (*domain.User, error) {
	const query = `
		update users
		set password = $2
		where id = $1
		returning id, google_sub, email, password, full_name, role, created_at
	`

	q := extractTransaction(ctx, r.db)
	var user domain.User
	if err := sqlx.GetContext(ctx, q, &user, query, userID, passwordHash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &user, nil
}

func (r *UsersRepository) Delete(ctx context.Context, userID uuid.UUID) error {
	const query = `delete from users where id = $1`

	q := extractTransaction(ctx, r.db)
	_, err := q.ExecContext(ctx, query, userID)
	return err
}
