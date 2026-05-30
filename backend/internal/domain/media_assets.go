package domain

import (
	"time"

	"github.com/google/uuid"
)

type MediaAssetKind string

const (
	MediaAssetKindImage MediaAssetKind = "image"
	MediaAssetKindVideo MediaAssetKind = "video"
	MediaAssetKindPDF   MediaAssetKind = "pdf"
	MediaAssetKindFile  MediaAssetKind = "file"
)

type MediaAsset struct {
	Id           uuid.UUID      `db:"id" json:"id"`
	OwnerId      uuid.UUID      `db:"owner_id" json:"owner_id"`
	CourseId     *uuid.UUID     `db:"course_id" json:"course_id,omitempty"`
	LessonId     *uuid.UUID     `db:"lesson_id" json:"lesson_id,omitempty"`
	Kind         MediaAssetKind `db:"kind" json:"kind"`
	OriginalName string         `db:"original_name" json:"original_name"`
	MimeType     string         `db:"mime_type" json:"mime_type"`
	SizeBytes    int64          `db:"size_bytes" json:"size_bytes"`
	StorageKey   string         `db:"storage_key" json:"storage_key"`
	PublicURL    string         `db:"public_url" json:"public_url"`
	CreatedAt    time.Time      `db:"created_at" json:"created_at"`
}

type CreateMediaAssetInput struct {
	OwnerId      uuid.UUID
	CourseId     *uuid.UUID
	LessonId     *uuid.UUID
	Kind         MediaAssetKind
	OriginalName string
	MimeType     string
	SizeBytes    int64
	StorageKey   string
	PublicURL    string
}
