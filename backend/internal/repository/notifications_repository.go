package repository

import (
	"context"
	"database/sql"
	"errors"

	"speaker_course/internal/domain"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type NotificationsRepository struct {
	db *sqlx.DB
}

func NewNotificationsRepository(db *sqlx.DB) *NotificationsRepository {
	return &NotificationsRepository{db: db}
}

func (r *NotificationsRepository) Create(
	ctx context.Context,
	input domain.CreateNotificationInput,
) (*domain.Notification, error) {
	const query = `
		insert into notifications (user_id, actor_id, course_id, enrollment_id, type, title, body)
		values ($1, $2, $3, $4, $5, $6, $7)
		returning id, user_id, actor_id, course_id, enrollment_id, type, title, body,
			read_at, deleted_at, created_at
	`

	q := extractTransaction(ctx, r.db)
	var notification domain.Notification
	if err := sqlx.GetContext(
		ctx,
		q,
		&notification,
		query,
		input.UserId,
		input.ActorId,
		input.CourseId,
		input.EnrollmentId,
		input.Type,
		input.Title,
		input.Body,
	); err != nil {
		return nil, err
	}

	return &notification, nil
}

func (r *NotificationsRepository) ListByUser(
	ctx context.Context,
	userId uuid.UUID,
	limit int,
) ([]domain.Notification, error) {
	const query = `
		select id, user_id, actor_id, course_id, enrollment_id, type, title, body,
			read_at, deleted_at, created_at
		from notifications
		where user_id = $1
			and deleted_at is null
		order by created_at desc
		limit $2
	`

	q := extractTransaction(ctx, r.db)
	notifications := make([]domain.Notification, 0)
	if err := sqlx.SelectContext(ctx, q, &notifications, query, userId, limit); err != nil {
		return nil, err
	}

	return notifications, nil
}

func (r *NotificationsRepository) CountUnread(ctx context.Context, userId uuid.UUID) (int, error) {
	const query = `
		select count(*)
		from notifications
		where user_id = $1
			and read_at is null
			and deleted_at is null
	`

	q := extractTransaction(ctx, r.db)
	var count int
	if err := sqlx.GetContext(ctx, q, &count, query, userId); err != nil {
		return 0, err
	}

	return count, nil
}

func (r *NotificationsRepository) MarkAllRead(ctx context.Context, userId uuid.UUID) error {
	const query = `
		update notifications
		set read_at = coalesce(read_at, now())
		where user_id = $1
			and deleted_at is null
	`

	q := extractTransaction(ctx, r.db)
	_, err := q.ExecContext(ctx, query, userId)
	return err
}

func (r *NotificationsRepository) MarkRead(ctx context.Context, notificationId uuid.UUID, userId uuid.UUID) (*domain.Notification, error) {
	const query = `
		update notifications
		set read_at = coalesce(read_at, now())
		where id = $1
			and user_id = $2
			and deleted_at is null
		returning id, user_id, actor_id, course_id, enrollment_id, type, title, body,
			read_at, deleted_at, created_at
	`

	q := extractTransaction(ctx, r.db)
	var notification domain.Notification
	if err := sqlx.GetContext(ctx, q, &notification, query, notificationId, userId); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &notification, nil
}

func (r *NotificationsRepository) Delete(ctx context.Context, notificationId uuid.UUID, userId uuid.UUID) error {
	const query = `
		update notifications
		set deleted_at = coalesce(deleted_at, now())
		where id = $1
			and user_id = $2
	`

	q := extractTransaction(ctx, r.db)
	_, err := q.ExecContext(ctx, query, notificationId, userId)
	return err
}
