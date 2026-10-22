package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
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
var ErrMediaProvider = errors.New("media provider unavailable")

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
	VideoId            string `json:"video_id"`
	LibraryId          string `json:"library_id"`
	CompleteAPIVersion int    `json:"complete_api_version"`
	ExpirationTime     int64  `json:"expiration_time"`
	Signature          string `json:"signature"`
	TusEndpoint        string `json:"tus_endpoint"`
	EmbedURL           string `json:"embed_url"`
}

type StreamVideoStatus struct {
	VideoId          string `json:"video_id"`
	Status           int    `json:"status"`
	StatusLabel      string `json:"status_label"`
	EncodeProgress   int    `json:"encode_progress"`
	Playable         bool   `json:"playable"`
	Failed           bool   `json:"failed"`
	ErrorMessage     string `json:"error_message,omitempty"`
	EmbedURL         string `json:"embed_url"`
	AvailableQuality string `json:"available_quality,omitempty"`
}

type CompleteStreamUploadInput struct {
	OwnerId        uuid.UUID
	CourseId       *uuid.UUID
	LessonId       *uuid.UUID
	VideoId        string
	Title          string
	SizeBytes      int64
	ExpirationTime int64
	Signature      string
}

func NewMediaService(cfg *config.Config, rp *repository.MediaAssetsRepository) *MediaService {
	return &MediaService{
		cfg: cfg,
		rp:  rp,
		httpClient: &http.Client{
			Timeout: 60 * time.Minute,
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

	assetInput := domain.CreateMediaAssetInput{
		OwnerId:      input.OwnerId,
		CourseId:     input.CourseId,
		LessonId:     input.LessonId,
		Kind:         input.Kind,
		OriginalName: input.OriginalName,
		MimeType:     input.MimeType,
		SizeBytes:    input.SizeBytes,
		StorageKey:   storageKey,
		PublicURL:    joinURL(s.cfg.BunnyStorageCDN, storageKey),
	}
	asset, err := s.createMediaAssetWithRetry(ctx, assetInput)
	if err != nil {
		log.Printf("bunny storage upload needs reconciliation: storage_key=%s: %v", storageKey, err)
		return nil, fmt.Errorf("file uploaded to Bunny Storage but could not be registered (storage key: %s): %w", storageKey, err)
	}
	return asset, nil
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
		VideoId:            videoID,
		LibraryId:          s.cfg.BunnyStreamID,
		CompleteAPIVersion: 2,
		ExpirationTime:     expiresAt,
		Signature:          signature,
		TusEndpoint:        "https://video.bunnycdn.com/tusupload",
		EmbedURL:           s.streamEmbedURL(videoID),
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
	if err := s.validateStreamConfig(); err != nil {
		return nil, err
	}
	if _, err := uuid.Parse(input.VideoId); err != nil {
		return nil, fmt.Errorf("%w: invalid video_id", ErrInvalidMedia)
	}
	if err := s.validateStreamUploadSignature(input.VideoId, input.ExpirationTime, input.Signature); err != nil {
		return nil, err
	}
	if _, err := s.waitForStreamUpload(ctx, input.VideoId); err != nil {
		return nil, fmt.Errorf("could not verify Bunny Stream video: %w", err)
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Video"
	}

	storageKey := fmt.Sprintf("bunny-stream/%s/%s", s.cfg.BunnyStreamID, input.VideoId)
	assetInput := domain.CreateMediaAssetInput{
		OwnerId:      input.OwnerId,
		CourseId:     input.CourseId,
		LessonId:     input.LessonId,
		Kind:         domain.MediaAssetKindVideo,
		OriginalName: title,
		MimeType:     "video/*",
		SizeBytes:    input.SizeBytes,
		StorageKey:   storageKey,
		PublicURL:    s.streamEmbedURL(input.VideoId),
	}
	asset, err := s.createMediaAssetWithRetry(ctx, assetInput)
	if err != nil {
		log.Printf("bunny stream upload needs reconciliation: video_id=%s: %v", input.VideoId, err)
		return nil, fmt.Errorf("video uploaded to Bunny Stream but could not be registered (video ID: %s): %w", input.VideoId, err)
	}
	return asset, nil
}

func (s *MediaService) validateStreamUploadSignature(videoID string, expiresAt int64, signature string) error {
	if expiresAt <= time.Now().Unix() || expiresAt > time.Now().Add(24*time.Hour).Unix() {
		return fmt.Errorf("%w: stream upload credentials expired", ErrInvalidMedia)
	}
	payload := s.cfg.BunnyStreamID + s.cfg.BunnyStreamKey + fmt.Sprint(expiresAt) + videoID
	expected := sha256.Sum256([]byte(payload))
	provided, err := hex.DecodeString(signature)
	if err != nil || subtle.ConstantTimeCompare(expected[:], provided) != 1 {
		return fmt.Errorf("%w: invalid stream upload credentials", ErrInvalidMedia)
	}
	return nil
}

func (s *MediaService) createMediaAssetWithRetry(ctx context.Context, input domain.CreateMediaAssetInput) (*domain.MediaAsset, error) {
	asset, err := s.rp.Create(ctx, input)
	if err == nil || ctx.Err() != nil {
		return asset, err
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(250 * time.Millisecond):
	}
	return s.rp.Create(ctx, input)
}

func (s *MediaService) waitForStreamUpload(ctx context.Context, videoID string) (*bunnyVideoStatusResponse, error) {
	for attempt := 0; attempt < 5; attempt++ {
		status, err := s.getBunnyVideoStatus(ctx, videoID)
		if err != nil {
			return nil, err
		}
		if !strings.EqualFold(status.Guid, videoID) || status.Status == 5 || status.Status == 8 {
			return nil, fmt.Errorf("%w: Bunny Stream video is unavailable or failed", ErrInvalidMedia)
		}
		if status.HasOriginal || status.StorageSize > 0 || status.EncodeProgress > 0 || status.Status == 7 ||
			status.Status == 2 || status.Status == 3 || status.Status == 4 ||
			strings.TrimSpace(status.AvailableResolutions) != "" {
			return status, nil
		}
		if attempt == 4 {
			break
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return nil, fmt.Errorf("%w: Bunny Stream upload is not available yet; retry completion", ErrInvalidMedia)
}

func (s *MediaService) GetStreamVideoStatus(ctx context.Context, videoID string) (*StreamVideoStatus, error) {
	if err := s.validateStreamConfig(); err != nil {
		return nil, err
	}

	videoID = strings.TrimSpace(videoID)
	if _, err := uuid.Parse(videoID); err != nil {
		return nil, fmt.Errorf("%w: invalid video_id", ErrInvalidMedia)
	}

	status, err := s.getBunnyVideoStatus(ctx, videoID)
	if err != nil {
		return nil, err
	}

	playable := status.Status == 3 || status.Status == 4
	failed := status.Status == 5 || status.Status == 8

	return &StreamVideoStatus{
		VideoId:          videoID,
		Status:           status.Status,
		StatusLabel:      streamStatusLabel(status.Status, status.EncodeProgress),
		EncodeProgress:   status.EncodeProgress,
		Playable:         playable && !failed,
		Failed:           failed,
		ErrorMessage:     streamFailureMessage(status),
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
	ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	uploadURL := joinURL(s.cfg.BunnyStorageURL, s.cfg.BunnyStorageZone, storageKey)
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, body)
	if err != nil {
		return err
	}
	request.Header.Set("AccessKey", s.cfg.BunnyStorageKey)
	request.Header.Set("Content-Type", mimeType)

	response, err := s.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("%w: bunny storage upload failed: %v", ErrMediaProvider, err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusCreated && response.StatusCode != http.StatusOK {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return fmt.Errorf("%w: bunny storage returned %s: %s", ErrMediaProvider, response.Status, string(message))
	}

	return nil
}

func (s *MediaService) createBunnyVideo(ctx context.Context, title string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
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
		return "", fmt.Errorf("%w: bunny stream create failed: %v", ErrMediaProvider, err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return "", fmt.Errorf("%w: bunny stream returned %s: %s", ErrMediaProvider, response.Status, string(message))
	}

	var result struct {
		Guid string `json:"guid"`
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("%w: invalid Bunny Stream create response: %v", ErrMediaProvider, err)
	}
	if strings.TrimSpace(result.Guid) == "" {
		return "", fmt.Errorf("%w: bunny stream did not return video guid", ErrMediaProvider)
	}

	return result.Guid, nil
}

type bunnyVideoStatusResponse struct {
	Guid                 string `json:"guid"`
	Status               int    `json:"status"`
	EncodeProgress       int    `json:"encodeProgress"`
	AvailableResolutions string `json:"availableResolutions"`
	StorageSize          int64  `json:"storageSize"`
	HasOriginal          bool   `json:"hasOriginal"`
	TranscodingMessages  []struct {
		Message string `json:"message"`
	} `json:"transcodingMessages"`
}

func streamFailureMessage(status *bunnyVideoStatusResponse) string {
	if status.Status != 5 && status.Status != 8 {
		return ""
	}
	for i := len(status.TranscodingMessages) - 1; i >= 0; i-- {
		message := strings.TrimSpace(status.TranscodingMessages[i].Message)
		if message != "" {
			if strings.Contains(strings.ToLower(message), "invalid file") {
				return "Bunny не смог прочитать исходный видеофайл (Invalid file). Проверьте файл локально и загрузите его заново."
			}
			return message
		}
	}
	return "Bunny Stream не сообщил подробностей ошибки"
}

func (s *MediaService) getBunnyVideoStatus(
	ctx context.Context,
	videoID string,
) (*bunnyVideoStatusResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	statusURL := fmt.Sprintf("https://video.bunnycdn.com/library/%s/videos/%s", s.cfg.BunnyStreamID, videoID)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, statusURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("AccessKey", s.cfg.BunnyStreamKey)

	response, err := s.httpClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("%w: bunny stream status failed: %v", ErrMediaProvider, err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return nil, fmt.Errorf("%w: bunny stream returned %s: %s", ErrMediaProvider, response.Status, string(message))
	}

	var result bunnyVideoStatusResponse
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("%w: invalid Bunny Stream status response: %v", ErrMediaProvider, err)
	}
	if !strings.EqualFold(result.Guid, videoID) {
		return nil, fmt.Errorf("%w: Bunny Stream returned a different video ID", ErrMediaProvider)
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
		return "Ready"
	case 4:
		return "Ready"
	case 5:
		return "Failed"
	case 6:
		return "Uploading"
	case 7:
		return "Uploaded"
	case 8:
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
