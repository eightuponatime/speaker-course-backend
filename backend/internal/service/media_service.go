package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"

	"speaker_course/config"
	"speaker_course/internal/domain"
	"speaker_course/internal/repository"

	"github.com/google/uuid"
)

var ErrInvalidMedia = errors.New("invalid media")

type MediaService struct {
	cfg        *config.Config
	rp         *repository.MediaAssetsRepository
	httpClient *http.Client
}

type UploadBunnyVideoInput struct {
	OwnerId  uuid.UUID
	CourseId *uuid.UUID
	LessonId *uuid.UUID
	Title    string
	File     multipart.File
	Header   *multipart.FileHeader
}

type BunnyVideoUploadResult struct {
	Asset     *domain.MediaAsset `json:"asset"`
	VideoID   string             `json:"video_id"`
	LibraryID string             `json:"library_id"`
	EmbedURL  string             `json:"embed_url"`
}

type bunnyCreateVideoRequest struct {
	Title string `json:"title"`
}

type bunnyCreateVideoResponse struct {
	VideoLibraryID int64  `json:"videoLibraryId"`
	GUID           string `json:"guid"`
	Title          string `json:"title"`
}

type bunnyUploadVideoResponse struct {
	Success    bool    `json:"success"`
	Message    *string `json:"message"`
	StatusCode int     `json:"statusCode"`
}

func NewMediaService(cfg *config.Config, rp *repository.MediaAssetsRepository) *MediaService {
	return &MediaService{
		cfg:        cfg,
		rp:         rp,
		httpClient: http.DefaultClient,
	}
}

func (s *MediaService) UploadBunnyVideo(
	ctx context.Context,
	input UploadBunnyVideoInput,
) (*BunnyVideoUploadResult, error) {
	if input.OwnerId == uuid.Nil {
		return nil, fmt.Errorf("%w: owner_id is empty", ErrInvalidMedia)
	}
	if input.File == nil || input.Header == nil {
		return nil, fmt.Errorf("%w: video file is required", ErrInvalidMedia)
	}
	if input.Header.Size <= 0 {
		return nil, fmt.Errorf("%w: video file is empty", ErrInvalidMedia)
	}

	mimeType := input.Header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	if !strings.HasPrefix(mimeType, "video/") {
		return nil, fmt.Errorf("%w: file must be a video", ErrInvalidMedia)
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = strings.TrimSuffix(input.Header.Filename, filepath.Ext(input.Header.Filename))
	}
	if strings.TrimSpace(title) == "" {
		return nil, fmt.Errorf("%w: video title is empty", ErrInvalidMedia)
	}

	video, err := s.createBunnyVideo(ctx, title)
	if err != nil {
		return nil, err
	}

	if err := s.uploadBunnyVideoFile(ctx, video.GUID, input.File); err != nil {
		return nil, err
	}

	embedURL := s.bunnyEmbedURL(video.GUID)
	asset, err := s.rp.Create(ctx, domain.CreateMediaAssetInput{
		OwnerId:      input.OwnerId,
		CourseId:     input.CourseId,
		LessonId:     input.LessonId,
		Kind:         domain.MediaAssetKindVideo,
		OriginalName: input.Header.Filename,
		MimeType:     mimeType,
		SizeBytes:    input.Header.Size,
		StorageKey:   fmt.Sprintf("bunny_stream:%s:%s", s.cfg.BunnyStreamLibraryID, video.GUID),
		PublicURL:    embedURL,
	})
	if err != nil {
		return nil, err
	}

	return &BunnyVideoUploadResult{
		Asset:     asset,
		VideoID:   video.GUID,
		LibraryID: s.cfg.BunnyStreamLibraryID,
		EmbedURL:  embedURL,
	}, nil
}

func (s *MediaService) createBunnyVideo(ctx context.Context, title string) (*bunnyCreateVideoResponse, error) {
	if s.cfg.BunnyStreamLibraryID == "" || s.cfg.BunnyStreamAPIKey == "" {
		return nil, fmt.Errorf("%w: bunny stream is not configured", ErrInvalidMedia)
	}

	body, err := json.Marshal(bunnyCreateVideoRequest{Title: title})
	if err != nil {
		return nil, err
	}

	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("https://video.bunnycdn.com/library/%s/videos", s.cfg.BunnyStreamLibraryID),
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, err
	}
	request.Header.Set("AccessKey", s.cfg.BunnyStreamAPIKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := s.httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("%w: bunny create video failed: %s", ErrInvalidMedia, readSmallBody(response.Body))
	}

	var video bunnyCreateVideoResponse
	if err := json.NewDecoder(response.Body).Decode(&video); err != nil {
		return nil, err
	}
	if video.GUID == "" {
		return nil, fmt.Errorf("%w: bunny video id is empty", ErrInvalidMedia)
	}

	return &video, nil
}

func (s *MediaService) uploadBunnyVideoFile(ctx context.Context, videoID string, file multipart.File) error {
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPut,
		fmt.Sprintf("https://video.bunnycdn.com/library/%s/videos/%s", s.cfg.BunnyStreamLibraryID, videoID),
		file,
	)
	if err != nil {
		return err
	}
	request.Header.Set("AccessKey", s.cfg.BunnyStreamAPIKey)
	request.Header.Set("Content-Type", "application/octet-stream")

	response, err := s.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("%w: bunny upload video failed: %s", ErrInvalidMedia, readSmallBody(response.Body))
	}

	var uploadResponse bunnyUploadVideoResponse
	if err := json.NewDecoder(response.Body).Decode(&uploadResponse); err != nil {
		return err
	}
	if !uploadResponse.Success {
		message := "unknown error"
		if uploadResponse.Message != nil {
			message = *uploadResponse.Message
		}
		return fmt.Errorf("%w: bunny upload video failed: %s", ErrInvalidMedia, message)
	}

	return nil
}

func (s *MediaService) bunnyEmbedURL(videoID string) string {
	return fmt.Sprintf("https://player.mediadelivery.net/embed/%s/%s", s.cfg.BunnyStreamLibraryID, videoID)
}

func readSmallBody(body io.Reader) string {
	data, err := io.ReadAll(io.LimitReader(body, 4096))
	if err != nil {
		return "unable to read response body"
	}

	text := strings.TrimSpace(string(data))
	if text == "" {
		return "empty response body"
	}

	return text
}
