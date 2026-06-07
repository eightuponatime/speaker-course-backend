package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"speaker_course/config"
	"speaker_course/internal/domain"
	"speaker_course/internal/repository"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ErrInvalidMedia = errors.New("invalid media")

type MediaService struct {
	cfg        *config.Config
	rp         *repository.MediaAssetsRepository
	httpClient *http.Client
}

type UploadMediaInput struct {
	OwnerId      uuid.UUID
	CourseId     *uuid.UUID
	LessonId     *uuid.UUID
	Kind         domain.MediaAssetKind
	OriginalName string
	MimeType     string
	SizeBytes    int64
	Body         io.Reader
}

type CreateStreamUploadInput struct {
	Title string
}

type StreamUploadCredentials struct {
	VideoId        string `json:"video_id"`
	LibraryId      string `json:"library_id"`
	ExpirationTime int64  `json:"expiration_time"`
	Signature      string `json:"signature"`
	TusEndpoint    string `json:"tus_endpoint"`
	EmbedURL       string `json:"embed_url"`
}

type StreamVideoStatus struct {
	VideoId          string `json:"video_id"`
	Status           int    `json:"status"`
	StatusLabel      string `json:"status_label"`
	EncodeProgress   int    `json:"encode_progress"`
	Playable         bool   `json:"playable"`
	Failed           bool   `json:"failed"`
	EmbedURL         string `json:"embed_url"`
	AvailableQuality string `json:"available_quality,omitempty"`
}

type CompleteStreamUploadInput struct {
	OwnerId   uuid.UUID
	CourseId  *uuid.UUID
	LessonId  *uuid.UUID
	VideoId   string
	Title     string
	SizeBytes int64
}

func NewMediaService(cfg *config.Config, rp *repository.MediaAssetsRepository) *MediaService {
	return &MediaService{
		cfg: cfg,
		rp:  rp,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (s *MediaService) UploadToStorage(
	ctx context.Context,
	input UploadMediaInput,
) (*domain.MediaAsset, error) {
	if err := s.validateStorageConfig(); err != nil {
		return nil, err
	}
	if input.OwnerId == uuid.Nil {
		return nil, fmt.Errorf("%w: owner_id is empty", ErrInvalidMedia)
	}
	if input.Body == nil {
		return nil, fmt.Errorf("%w: file is empty", ErrInvalidMedia)
	}
	if input.SizeBytes <= 0 {
		return nil, fmt.Errorf("%w: file size must be positive", ErrInvalidMedia)
	}
	if input.SizeBytes > 50*1024*1024 {
		return nil, fmt.Errorf("%w: file is too large", ErrInvalidMedia)
	}
	if !isStorageKind(input.Kind) {
		return nil, fmt.Errorf("%w: unsupported storage kind", ErrInvalidMedia)
	}

	input.OriginalName = strings.TrimSpace(input.OriginalName)
	input.MimeType = strings.TrimSpace(input.MimeType)
	if input.OriginalName == "" {
		input.OriginalName = "file"
	}
	if input.MimeType == "" {
		input.MimeType = "application/octet-stream"
	}

	if err := validateMimeForKind(input.Kind, input.MimeType); err != nil {
		return nil, err
	}

	storageKey := buildStorageKey(input.CourseId, input.LessonId, input.Kind, input.OriginalName, input.MimeType)
	if err := s.putStorageObject(ctx, storageKey, input.MimeType, input.Body); err != nil {
		return nil, err
	}

	return s.rp.Create(ctx, domain.CreateMediaAssetInput{
		OwnerId:      input.OwnerId,
		CourseId:     input.CourseId,
		LessonId:     input.LessonId,
		Kind:         input.Kind,
		OriginalName: input.OriginalName,
		MimeType:     input.MimeType,
		SizeBytes:    input.SizeBytes,
		StorageKey:   storageKey,
		PublicURL:    joinURL(s.cfg.BunnyStorageCDN, storageKey),
	})
}

func (s *MediaService) CreateStreamUpload(
	ctx context.Context,
	input CreateStreamUploadInput,
) (*StreamUploadCredentials, error) {
	if err := s.validateStreamConfig(); err != nil {
		return nil, err
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Untitled video"
	}

	videoID, err := s.createBunnyVideo(ctx, title)
	if err != nil {
		return nil, err
	}

	expiresAt := time.Now().Add(24 * time.Hour).Unix()
	signaturePayload := s.cfg.BunnyStreamID + s.cfg.BunnyStreamKey + fmt.Sprint(expiresAt) + videoID
	hash := sha256.Sum256([]byte(signaturePayload))
	signature := hex.EncodeToString(hash[:])

	return &StreamUploadCredentials{
		VideoId:        videoID,
		LibraryId:      s.cfg.BunnyStreamID,
		ExpirationTime: expiresAt,
		Signature:      signature,
		TusEndpoint:    "https://video.bunnycdn.com/tusupload",
		EmbedURL:       s.streamEmbedURL(videoID),
	}, nil
}

func (s *MediaService) CompleteStreamUpload(
	ctx context.Context,
	input CompleteStreamUploadInput,
) (*domain.MediaAsset, error) {
	if input.OwnerId == uuid.Nil {
		return nil, fmt.Errorf("%w: owner_id is empty", ErrInvalidMedia)
	}
	input.VideoId = strings.TrimSpace(input.VideoId)
	if input.VideoId == "" {
		return nil, fmt.Errorf("%w: video_id is empty", ErrInvalidMedia)
	}
	if input.SizeBytes <= 0 {
		return nil, fmt.Errorf("%w: size_bytes must be positive", ErrInvalidMedia)
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Video"
	}

	storageKey := fmt.Sprintf("bunny-stream/%s/%s", s.cfg.BunnyStreamID, input.VideoId)
	return s.rp.Create(ctx, domain.CreateMediaAssetInput{
		OwnerId:      input.OwnerId,
		CourseId:     input.CourseId,
		LessonId:     input.LessonId,
		Kind:         domain.MediaAssetKindVideo,
		OriginalName: title,
		MimeType:     "video/*",
		SizeBytes:    input.SizeBytes,
		StorageKey:   storageKey,
		PublicURL:    s.streamEmbedURL(input.VideoId),
	})
}

func (s *MediaService) GetStreamVideoStatus(ctx context.Context, videoID string) (*StreamVideoStatus, error) {
	if err := s.validateStreamConfig(); err != nil {
		return nil, err
	}

	videoID = strings.TrimSpace(videoID)
	if videoID == "" {
		return nil, fmt.Errorf("%w: video_id is empty", ErrInvalidMedia)
	}

	status, err := s.getBunnyVideoStatus(ctx, videoID)
	if err != nil {
		return nil, err
	}

	playable := status.EncodeProgress >= 100 ||
		strings.TrimSpace(status.AvailableResolutions) != "" ||
		status.Status == 3 ||
		status.Status == 4
	failed := status.Status == 5 || status.Status == 6

	return &StreamVideoStatus{
		VideoId:          videoID,
		Status:           status.Status,
		StatusLabel:      streamStatusLabel(status.Status, status.EncodeProgress),
		EncodeProgress:   status.EncodeProgress,
		Playable:         playable && !failed,
		Failed:           failed,
		EmbedURL:         s.streamEmbedURL(videoID),
		AvailableQuality: status.AvailableResolutions,
	}, nil
}

func (s *MediaService) validateStorageConfig() error {
	if strings.TrimSpace(s.cfg.BunnyStorageZone) == "" {
		return fmt.Errorf("%w: BUNNY_STORAGE_ZONE is not configured", ErrInvalidMedia)
	}
	if strings.TrimSpace(s.cfg.BunnyStorageKey) == "" {
		return fmt.Errorf("%w: BUNNY_STORAGE_PASSWORD is not configured", ErrInvalidMedia)
	}
	if strings.TrimSpace(s.cfg.BunnyStorageURL) == "" {
		return fmt.Errorf("%w: BUNNY_STORAGE_ENDPOINT is not configured", ErrInvalidMedia)
	}
	if strings.TrimSpace(s.cfg.BunnyStorageCDN) == "" {
		return fmt.Errorf("%w: BUNNY_STORAGE_PUBLIC_BASE_URL is not configured", ErrInvalidMedia)
	}

	return nil
}

func (s *MediaService) validateStreamConfig() error {
	if strings.TrimSpace(s.cfg.BunnyStreamID) == "" {
		return fmt.Errorf("%w: BUNNY_STREAM_LIBRARY_ID is not configured", ErrInvalidMedia)
	}
	if strings.TrimSpace(s.cfg.BunnyStreamKey) == "" {
		return fmt.Errorf("%w: BUNNY_STREAM_API_KEY is not configured", ErrInvalidMedia)
	}

	return nil
}

func (s *MediaService) putStorageObject(
	ctx context.Context,
	storageKey string,
	mimeType string,
	body io.Reader,
) error {
	uploadURL := joinURL(s.cfg.BunnyStorageURL, s.cfg.BunnyStorageZone, storageKey)
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, body)
	if err != nil {
		return err
	}
	request.Header.Set("AccessKey", s.cfg.BunnyStorageKey)
	request.Header.Set("Content-Type", mimeType)

	response, err := s.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusCreated && response.StatusCode != http.StatusOK {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return fmt.Errorf("%w: bunny storage returned %s: %s", ErrInvalidMedia, response.Status, string(message))
	}

	return nil
}

func (s *MediaService) createBunnyVideo(ctx context.Context, title string) (string, error) {
	payload, err := json.Marshal(map[string]string{"title": title})
	if err != nil {
		return "", err
	}

	createURL := fmt.Sprintf("https://video.bunnycdn.com/library/%s/videos", s.cfg.BunnyStreamID)
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, createURL, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("AccessKey", s.cfg.BunnyStreamKey)

	response, err := s.httpClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return "", fmt.Errorf("%w: bunny stream returned %s: %s", ErrInvalidMedia, response.Status, string(message))
	}

	var result struct {
		Guid string `json:"guid"`
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return "", err
	}
	if strings.TrimSpace(result.Guid) == "" {
		return "", fmt.Errorf("%w: bunny stream did not return video guid", ErrInvalidMedia)
	}

	return result.Guid, nil
}

type bunnyVideoStatusResponse struct {
	Status               int    `json:"status"`
	EncodeProgress       int    `json:"encodeProgress"`
	AvailableResolutions string `json:"availableResolutions"`
}

func (s *MediaService) getBunnyVideoStatus(
	ctx context.Context,
	videoID string,
) (*bunnyVideoStatusResponse, error) {
	statusURL := fmt.Sprintf("https://video.bunnycdn.com/library/%s/videos/%s", s.cfg.BunnyStreamID, videoID)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, statusURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("AccessKey", s.cfg.BunnyStreamKey)

	response, err := s.httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return nil, fmt.Errorf("%w: bunny stream returned %s: %s", ErrInvalidMedia, response.Status, string(message))
	}

	var result bunnyVideoStatusResponse
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

func streamStatusLabel(status int, encodeProgress int) string {
	switch status {
	case 0:
		return "Queued"
	case 1:
		return "Processing"
	case 2:
		return "Encoding"
	case 3:
		if encodeProgress >= 100 {
			return "Ready"
		}
		return "Transcoding"
	case 4:
		return "Ready"
	case 5:
		return "Failed"
	case 6:
		return "Upload failed"
	default:
		if encodeProgress > 0 && encodeProgress < 100 {
			return "Encoding"
		}
		return "Processing"
	}
}

func (s *MediaService) streamEmbedURL(videoID string) string {
	return joinURL(s.cfg.BunnyStreamEmbed, s.cfg.BunnyStreamID, videoID)
}

func isStorageKind(kind domain.MediaAssetKind) bool {
	return kind == domain.MediaAssetKindImage ||
		kind == domain.MediaAssetKindPDF ||
		kind == domain.MediaAssetKindFile
}

func validateMimeForKind(kind domain.MediaAssetKind, mimeType string) error {
	switch kind {
	case domain.MediaAssetKindImage:
		if !strings.HasPrefix(mimeType, "image/") {
			return fmt.Errorf("%w: image upload requires image mime type", ErrInvalidMedia)
		}
	case domain.MediaAssetKindPDF:
		if mimeType != "application/pdf" {
			return fmt.Errorf("%w: pdf upload requires application/pdf", ErrInvalidMedia)
		}
	}

	return nil
}

func buildStorageKey(
	courseID *uuid.UUID,
	lessonID *uuid.UUID,
	kind domain.MediaAssetKind,
	originalName string,
	mimeType string,
) string {
	extension := strings.ToLower(filepath.Ext(originalName))
	if extension == "" {
		extensions, _ := mime.ExtensionsByType(mimeType)
		if len(extensions) > 0 {
			extension = extensions[0]
		}
	}

	fileName := uuid.NewString() + extension
	if lessonID != nil {
		return fmt.Sprintf("courses/%s/lessons/%s/%ss/%s", idSegment(courseID), lessonID.String(), kind, fileName)
	}
	if courseID != nil {
		return fmt.Sprintf("courses/%s/%ss/%s", courseID.String(), kind, fileName)
	}

	return fmt.Sprintf("uploads/%ss/%s", kind, fileName)
}

func idSegment(id *uuid.UUID) string {
	if id == nil {
		return "unassigned"
	}

	return id.String()
}

func joinURL(parts ...string) string {
	cleaned := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.Trim(part, "/")
		if part != "" {
			cleaned = append(cleaned, part)
		}
	}

	if len(cleaned) == 0 {
		return ""
	}

	if strings.HasPrefix(parts[0], "http://") || strings.HasPrefix(parts[0], "https://") {
		return strings.TrimRight(parts[0], "/") + "/" + strings.Join(cleaned[1:], "/")
	}

	return strings.Join(cleaned, "/")
}
