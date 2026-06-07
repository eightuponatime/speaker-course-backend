package repository

import (
	"context"

	"speaker_course/internal/domain"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type QuizResponsesRepository struct {
	db *sqlx.DB
}

func NewQuizResponsesRepository(db *sqlx.DB) *QuizResponsesRepository {
	return &QuizResponsesRepository{db: db}
}

func (r *QuizResponsesRepository) Save(
	ctx context.Context,
	input domain.SaveLessonQuizResponseInput,
) (*domain.LessonQuizResponse, error) {
	const query = `
		insert into lesson_quiz_responses (lesson_id, user_id, quiz_id, selected_option_index)
		values ($1, $2, $3, $4)
		on conflict (lesson_id, user_id, quiz_id)
		do update set selected_option_index = excluded.selected_option_index,
			updated_at = now()
		returning id, lesson_id, user_id, quiz_id, selected_option_index, created_at, updated_at
	`

	q := extractTransaction(ctx, r.db)
	var response domain.LessonQuizResponse
	if err := sqlx.GetContext(
		ctx,
		q,
		&response,
		query,
		input.LessonId,
		input.UserId,
		input.QuizId,
		input.SelectedOptionIndex,
	); err != nil {
		return nil, err
	}

	return &response, nil
}

func (r *QuizResponsesRepository) ListByLessonAndUser(
	ctx context.Context,
	lessonId uuid.UUID,
	userId uuid.UUID,
) ([]domain.LessonQuizResponse, error) {
	const query = `
		select id, lesson_id, user_id, quiz_id, selected_option_index, created_at, updated_at
		from lesson_quiz_responses
		where lesson_id = $1
			and user_id = $2
		order by updated_at desc
	`

	q := extractTransaction(ctx, r.db)
	responses := make([]domain.LessonQuizResponse, 0)
	if err := sqlx.SelectContext(ctx, q, &responses, query, lessonId, userId); err != nil {
		return nil, err
	}

	return responses, nil
}

func (r *QuizResponsesRepository) ListByLesson(
	ctx context.Context,
	lessonId uuid.UUID,
) ([]domain.LessonQuizResponseWithUser, error) {
	const query = `
		select r.id,
			r.lesson_id,
			r.user_id,
			r.quiz_id,
			r.selected_option_index,
			r.created_at,
			r.updated_at,
			u.email as user_email,
			u.full_name as user_full_name
		from lesson_quiz_responses r
		join users u on u.id = r.user_id
		where r.lesson_id = $1
		order by r.updated_at desc
	`

	q := extractTransaction(ctx, r.db)
	responses := make([]domain.LessonQuizResponseWithUser, 0)
	if err := sqlx.SelectContext(ctx, q, &responses, query, lessonId); err != nil {
		return nil, err
	}

	return responses, nil
}
