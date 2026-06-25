package repository

import (
	"context"
	"speaker_course/internal/domain"

	"github.com/jmoiron/sqlx"
)

type ActivityRepository struct {
	db *sqlx.DB
}

func NewActivityRepository(db *sqlx.DB) *ActivityRepository {
	return &ActivityRepository{db: db}
}

func (r *ActivityRepository) TrackCourseActivity(
	ctx context.Context,
	input domain.TrackCourseActivityInput,
) (*domain.CourseStudentActivity, error) {
	const query = `
		with progress_upsert as (
			insert into lesson_progress (lesson_id, user_id, first_viewed_at, updated_at)
			values ($3, $2, now(), now())
			on conflict (lesson_id, user_id) do update
			set updated_at = now()
			returning lesson_id
		),
		activity_upsert as (
			insert into course_student_activity (
				course_id,
				user_id,
				current_lesson_id,
				last_seen_at,
				online_until,
				first_access_at,
				access_expires_at,
				updated_at
			)
			values ($1, $2, $3, now(), now() + interval '45 seconds', now(), now() + interval '1 month', now())
			on conflict (course_id, user_id) do update
			set current_lesson_id = excluded.current_lesson_id,
				last_seen_at = now(),
				online_until = now() + interval '45 seconds',
				first_access_at = coalesce(course_student_activity.first_access_at, now()),
				access_expires_at = coalesce(course_student_activity.access_expires_at, coalesce(course_student_activity.first_access_at, now()) + interval '1 month'),
				updated_at = now()
			returning course_id, user_id, current_lesson_id, last_seen_at, online_until, first_access_at, access_expires_at, created_at, updated_at
		)
		select activity_upsert.course_id,
			activity_upsert.user_id,
			activity_upsert.current_lesson_id,
			activity_upsert.last_seen_at,
			activity_upsert.online_until,
			(activity_upsert.online_until > now()) as is_online,
			activity_upsert.first_access_at,
			activity_upsert.access_expires_at,
			coalesce(activity_upsert.access_expires_at <= now(), false) as is_access_expired,
			activity_upsert.created_at,
			activity_upsert.updated_at,
			u.email as user_email,
			u.full_name as user_full_name,
			l.title as current_lesson_title,
			s.id as current_section_id,
			s.title as current_section_title,
			null::timestamptz as last_login_at,
			0 as viewed_lessons,
			0 as total_lessons
		from activity_upsert
		join users u on u.id = activity_upsert.user_id
		left join lessons l on l.id = activity_upsert.current_lesson_id
		left join course_sections s on s.id = l.section_id
	`

	q := extractTransaction(ctx, r.db)
	var activity domain.CourseStudentActivity
	if err := sqlx.GetContext(ctx, q, &activity, query, input.CourseId, input.UserId, input.LessonId); err != nil {
		return nil, err
	}

	return &activity, nil
}

func (r *ActivityRepository) EnsureCourseAccessStarted(
	ctx context.Context,
	input domain.MarkCourseActivityOfflineInput,
) (*domain.CourseAccessWindow, error) {
	const query = `
		insert into course_student_activity (course_id, user_id, first_access_at, access_expires_at, updated_at)
		values ($1, $2, now(), now() + interval '1 month', now())
		on conflict (course_id, user_id) do update
		set first_access_at = coalesce(course_student_activity.first_access_at, now()),
			access_expires_at = coalesce(course_student_activity.access_expires_at, coalesce(course_student_activity.first_access_at, now()) + interval '1 month'),
			updated_at = now()
		returning course_id,
			user_id,
			first_access_at,
			access_expires_at,
			coalesce(access_expires_at <= now(), false) as is_expired
	`

	q := extractTransaction(ctx, r.db)
	var access domain.CourseAccessWindow
	if err := sqlx.GetContext(ctx, q, &access, query, input.CourseId, input.UserId); err != nil {
		return nil, err
	}

	return &access, nil
}

func (r *ActivityRepository) MarkCourseActivityOffline(
	ctx context.Context,
	input domain.MarkCourseActivityOfflineInput,
) error {
	const query = `
		update course_student_activity
		set online_until = now(),
			updated_at = now()
		where course_id = $1
			and user_id = $2
	`

	q := extractTransaction(ctx, r.db)
	_, err := q.ExecContext(ctx, query, input.CourseId, input.UserId)
	return err
}

func (r *ActivityRepository) ExtendCourseAccess(
	ctx context.Context,
	input domain.ExtendCourseAccessInput,
) (*domain.CourseAccessWindow, error) {
	const query = `
		insert into course_student_activity (course_id, user_id, first_access_at, access_expires_at, updated_at)
		values ($1, $2, now(), $3, now())
		on conflict (course_id, user_id) do update
		set first_access_at = coalesce(course_student_activity.first_access_at, now()),
			access_expires_at = excluded.access_expires_at,
			updated_at = now()
		returning course_id,
			user_id,
			first_access_at,
			access_expires_at,
			coalesce(access_expires_at <= now(), false) as is_expired
	`

	q := extractTransaction(ctx, r.db)
	var access domain.CourseAccessWindow
	if err := sqlx.GetContext(ctx, q, &access, query, input.CourseId, input.UserId, input.AccessExpiresAt); err != nil {
		return nil, err
	}

	return &access, nil
}

func (r *ActivityRepository) ListCourseStudentActivity(
	ctx context.Context,
	courseId string,
) ([]domain.CourseStudentActivity, error) {
	const query = `
		with total_lessons as (
			select count(*)::int as value
			from lessons
			where course_id = $1
		),
		viewed_lessons as (
			select lp.user_id, count(distinct lp.lesson_id)::int as value
			from lesson_progress lp
			join lessons l on l.id = lp.lesson_id
			where l.course_id = $1
			group by lp.user_id
		),
		last_sessions as (
			select user_id, max(created_at) as last_login_at
			from sessions
			group by user_id
		)
		select e.course_id,
			e.user_id,
			a.current_lesson_id,
			a.last_seen_at,
			a.online_until,
			coalesce(a.online_until > now(), false) as is_online,
			a.first_access_at,
			a.access_expires_at,
			coalesce(a.access_expires_at <= now(), false) as is_access_expired,
			coalesce(a.created_at, e.requested_at) as created_at,
			coalesce(a.updated_at, e.requested_at) as updated_at,
			u.email as user_email,
			u.full_name as user_full_name,
			l.title as current_lesson_title,
			s.id as current_section_id,
			s.title as current_section_title,
			ls.last_login_at,
			coalesce(v.value, 0) as viewed_lessons,
			coalesce(t.value, 0) as total_lessons
		from course_enrollments e
		join users u on u.id = e.user_id
		left join course_student_activity a on a.course_id = e.course_id and a.user_id = e.user_id
		left join lessons l on l.id = a.current_lesson_id
		left join course_sections s on s.id = l.section_id
		left join viewed_lessons v on v.user_id = e.user_id
		cross join total_lessons t
		left join last_sessions ls on ls.user_id = e.user_id
		where e.course_id = $1
			and e.status = 'approved'
		order by a.last_seen_at desc nulls last, e.reviewed_at desc nulls last, e.requested_at desc
	`

	q := extractTransaction(ctx, r.db)
	items := make([]domain.CourseStudentActivity, 0)
	if err := sqlx.SelectContext(ctx, q, &items, query, courseId); err != nil {
		return nil, err
	}

	return items, nil
}

func (r *ActivityRepository) ListLessonProgressHistory(
	ctx context.Context,
	courseId string,
	userId string,
) ([]domain.LessonProgressHistoryItem, error) {
	const query = `
		select l.id as lesson_id,
			l.title as lesson_title,
			l.position as lesson_position,
			s.id as section_id,
			s.title as section_title,
			s.position as section_position,
			lp.first_viewed_at,
			lp.updated_at as last_attention_at
		from lessons l
		join course_sections s on s.id = l.section_id
		left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = $2
		where l.course_id = $1
		order by s.position, l.position
	`

	q := extractTransaction(ctx, r.db)
	items := make([]domain.LessonProgressHistoryItem, 0)
	if err := sqlx.SelectContext(ctx, q, &items, query, courseId, userId); err != nil {
		return nil, err
	}

	return items, nil
}
