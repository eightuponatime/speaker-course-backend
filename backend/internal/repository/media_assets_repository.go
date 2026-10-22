package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
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
		on conflict (storage_key) do nothing
		returning id, owner_id, course_id, lesson_id, kind, original_name,
			mime_type, size_bytes, storage_key, public_url, created_at
	`

	q := extractTransaction(ctx, r.db)
	var asset domain.MediaAsset
	err := sqlx.GetContext(
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
	)
	if errors.Is(err, sql.ErrNoRows) {
		// A lost response after a successful insert can be retried without creating
		// another media record or claiming another user's object.
		const existingQuery = `
			select id, owner_id, course_id, lesson_id, kind, original_name,
				mime_type, size_bytes, storage_key, public_url, created_at
			from media_assets
			where storage_key = $1 and owner_id = $2
				and course_id is not distinct from $3
				and lesson_id is not distinct from $4
				and kind = $5 and size_bytes = $6
		`
		if lookupErr := sqlx.GetContext(ctx, q, &asset, existingQuery,
			input.StorageKey, input.OwnerId, input.CourseId, input.LessonId,
			input.Kind, input.SizeBytes); lookupErr != nil {
			if errors.Is(lookupErr, sql.ErrNoRows) {
				return nil, fmt.Errorf("media asset already exists with different details")
			}
			return nil, lookupErr
		}
		return &asset, nil
	}
	if err != nil {
		return nil, err
	}

	return &asset, nil
}
