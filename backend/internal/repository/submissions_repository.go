package repository

import (
	"context"
	"database/sql"
	"errors"
	"speaker_course/internal/domain"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type SubmissionsRepository struct {
	db *sqlx.DB
}

func NewSubmissionsRepository(db *sqlx.DB) *SubmissionsRepository {
	return &SubmissionsRepository{db: db}
}

func (r *SubmissionsRepository) Upsert(
	ctx context.Context,
	lessonID uuid.UUID,
	userID uuid.UUID,
	body string,
	attachments []byte,
) (*domain.LessonSubmission, error) {
	const query = `
		insert into lesson_submissions (lesson_id, course_id, user_id, status, body, attachments, submitted_at, updated_at)
		select l.id, l.course_id, $2, 'pending', $3, $4::jsonb, now(), now()
		from lessons l
		where l.id = $1
		on conflict (lesson_id, user_id) do update
		set status = 'pending',
			body = excluded.body,
			attachments = excluded.attachments,
			submitted_at = now(),
			reviewed_at = null,
			reviewed_by = null,
			viewed_by_admin_at = null,
			updated_at = now()
		returning id, lesson_id, course_id, user_id, status, body, attachments,
			viewed_by_admin_at, viewed_by_student_at, submitted_at, reviewed_at, reviewed_by,
			created_at, updated_at
	`

	q := extractTransaction(ctx, r.db)
	var submission domain.LessonSubmission
	if err := sqlx.GetContext(ctx, q, &submission, query, lessonID, userID, body, string(attachments)); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &submission, nil
}

func (r *SubmissionsRepository) GetByLessonAndUser(
	ctx context.Context,
	lessonID uuid.UUID,
	userID uuid.UUID,
) (*domain.LessonSubmission, error) {
	const query = `
		select id, lesson_id, course_id, user_id, status, body, attachments,
			viewed_by_admin_at, viewed_by_student_at, submitted_at, reviewed_at, reviewed_by,
			created_at, updated_at
		from lesson_submissions
		where lesson_id = $1 and user_id = $2
	`

	q := extractTransaction(ctx, r.db)
	var submission domain.LessonSubmission
	if err := sqlx.GetContext(ctx, q, &submission, query, lessonID, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &submission, nil
}

func (r *SubmissionsRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.LessonSubmission, error) {
	const query = `
		select id, lesson_id, course_id, user_id, status, body, attachments,
			viewed_by_admin_at, viewed_by_student_at, submitted_at, reviewed_at, reviewed_by,
			created_at, updated_at
		from lesson_submissions
		where id = $1
	`

	q := extractTransaction(ctx, r.db)
	var submission domain.LessonSubmission
	if err := sqlx.GetContext(ctx, q, &submission, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &submission, nil
}

func (r *SubmissionsRepository) ListMineByCourse(
	ctx context.Context,
	courseID uuid.UUID,
	userID uuid.UUID,
) ([]domain.LessonSubmissionSummary, error) {
	const query = `
		select s.id, s.lesson_id, s.course_id, s.user_id, s.status, s.updated_at, s.reviewed_at,
			s.viewed_by_admin_at, s.viewed_by_student_at,
			false as is_unread_for_admin,
			(select count(*) from lesson_submission_comments c where c.submission_id = s.id) as comment_count
		from lesson_submissions s
		where s.course_id = $1 and s.user_id = $2
		order by s.updated_at desc
	`

	q := extractTransaction(ctx, r.db)
	items := make([]domain.LessonSubmissionSummary, 0)
	if err := sqlx.SelectContext(ctx, q, &items, query, courseID, userID); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *SubmissionsRepository) ListAdminByCourse(
	ctx context.Context,
	courseID uuid.UUID,
) ([]domain.AdminLessonSubmissionListItem, error) {
	const query = `
		select s.id, s.lesson_id, s.course_id, s.user_id, s.status, s.updated_at, s.reviewed_at,
			s.viewed_by_admin_at, s.viewed_by_student_at,
			(s.viewed_by_admin_at is null or s.viewed_by_admin_at < s.updated_at) as is_unread_for_admin,
			(select count(*) from lesson_submission_comments c where c.submission_id = s.id) as comment_count,
			l.title as lesson_title,
			cs.title as section_title,
			u.email as user_email,
			u.full_name as user_full_name,
			left(s.body, 140) as body_preview,
			jsonb_array_length(s.attachments) as attachment_count
		from lesson_submissions s
		join lessons l on l.id = s.lesson_id
		join course_sections cs on cs.id = l.section_id
		join users u on u.id = s.user_id
		where s.course_id = $1
		order by is_unread_for_admin desc, s.updated_at desc
	`

	q := extractTransaction(ctx, r.db)
	items := make([]domain.AdminLessonSubmissionListItem, 0)
	if err := sqlx.SelectContext(ctx, q, &items, query, courseID); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *SubmissionsRepository) CountUnreadForAdmin(ctx context.Context, courseID uuid.UUID) (int, error) {
	const query = `
		select count(*)
		from lesson_submissions
		where course_id = $1
			and (viewed_by_admin_at is null or viewed_by_admin_at < updated_at)
	`

	q := extractTransaction(ctx, r.db)
	var count int
	if err := sqlx.GetContext(ctx, q, &count, query, courseID); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *SubmissionsRepository) AddComment(
	ctx context.Context,
	submissionID uuid.UUID,
	authorID uuid.UUID,
	body string,
	attachments []byte,
	authorIsAdmin bool,
) (*domain.LessonSubmissionComment, error) {
	const query = `
		with inserted as (
			insert into lesson_submission_comments (submission_id, author_id, body, attachments)
			values ($1, $2, $3, $4::jsonb)
			returning id, submission_id, author_id, body, attachments, created_at
		),
		touched as (
			update lesson_submissions
			set updated_at = now(),
				viewed_by_admin_at = case when $5 then now() else viewed_by_admin_at end,
				viewed_by_student_at = case when $5 then viewed_by_student_at else now() end
			where id = $1
		)
		select i.id, i.submission_id, i.author_id, i.body, i.attachments, i.created_at,
			u.email as author_email, u.full_name as author_full_name, u.role as author_role
		from inserted i
		join users u on u.id = i.author_id
	`

	q := extractTransaction(ctx, r.db)
	var comment domain.LessonSubmissionComment
	if err := sqlx.GetContext(ctx, q, &comment, query, submissionID, authorID, body, string(attachments), authorIsAdmin); err != nil {
		return nil, err
	}
	return &comment, nil
}

func (r *SubmissionsRepository) ListComments(
	ctx context.Context,
	submissionID uuid.UUID,
) ([]domain.LessonSubmissionComment, error) {
	const query = `
		select c.id, c.submission_id, c.author_id, c.body, c.attachments, c.created_at,
			u.email as author_email, u.full_name as author_full_name, u.role as author_role
		from lesson_submission_comments c
		join users u on u.id = c.author_id
		where c.submission_id = $1
		order by c.created_at asc
	`

	q := extractTransaction(ctx, r.db)
	items := make([]domain.LessonSubmissionComment, 0)
	if err := sqlx.SelectContext(ctx, q, &items, query, submissionID); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *SubmissionsRepository) UpdateStatus(
	ctx context.Context,
	submissionID uuid.UUID,
	status domain.LessonSubmissionStatus,
	adminID uuid.UUID,
) (*domain.LessonSubmission, error) {
	const query = `
		update lesson_submissions
		set status = $2,
			reviewed_at = now(),
			reviewed_by = $3,
			viewed_by_admin_at = now(),
			updated_at = now()
		where id = $1
		returning id, lesson_id, course_id, user_id, status, body, attachments,
			viewed_by_admin_at, viewed_by_student_at, submitted_at, reviewed_at, reviewed_by,
			created_at, updated_at
	`

	q := extractTransaction(ctx, r.db)
	var submission domain.LessonSubmission
	if err := sqlx.GetContext(ctx, q, &submission, query, submissionID, status, adminID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &submission, nil
}

func (r *SubmissionsRepository) MarkViewedByAdmin(ctx context.Context, submissionID uuid.UUID) error {
	const query = `update lesson_submissions set viewed_by_admin_at = now() where id = $1`
	q := extractTransaction(ctx, r.db)
	_, err := q.ExecContext(ctx, query, submissionID)
	return err
}

func (r *SubmissionsRepository) MarkViewedByStudent(ctx context.Context, submissionID uuid.UUID, userID uuid.UUID) error {
	const query = `update lesson_submissions set viewed_by_student_at = now() where id = $1 and user_id = $2`
	q := extractTransaction(ctx, r.db)
	_, err := q.ExecContext(ctx, query, submissionID, userID)
	return err
}
