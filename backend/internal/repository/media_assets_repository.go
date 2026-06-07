package repository

import (
	"context"
	"speaker_course/internal/domain"

	"github.com/jmoiron/sqlx"
)

type MediaAssetsRepository struct {
	db *sqlx.DB
}

func NewMediaAssetsRepository(db *sqlx.DB) *MediaAssetsRepository {
	return &MediaAssetsRepository{db: db}
}

func (r *MediaAssetsRepository) Create(
	ctx context.Context,
	input domain.CreateMediaAssetInput,
) (*domain.MediaAsset, error) {
	const query = `
		insert into media_assets (
			owner_id, course_id, lesson_id, kind, original_name, mime_type,
			size_bytes, storage_key, public_url
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		returning id, owner_id, course_id, lesson_id, kind, original_name,
			mime_type, size_bytes, storage_key, public_url, created_at
	`

	q := extractTransaction(ctx, r.db)
	var asset domain.MediaAsset
	if err := sqlx.GetContext(
		ctx,
		q,
		&asset,
		query,
		input.OwnerId,
		input.CourseId,
		input.LessonId,
		input.Kind,
		input.OriginalName,
		input.MimeType,
		input.SizeBytes,
		input.StorageKey,
		input.PublicURL,
	); err != nil {
		return nil, err
	}

	return &asset, nil
}
