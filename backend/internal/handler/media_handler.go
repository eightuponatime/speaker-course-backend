package handler

import (
	"net/http"
	"speaker_course/internal/domain"
	middlewarego "speaker_course/internal/middleware.go"
	"speaker_course/internal/service"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type MediaHandler struct {
	mediaService *service.MediaService
}

func NewMediaHandler(mediaService *service.MediaService) *MediaHandler {
	return &MediaHandler{mediaService: mediaService}
}

func (h *MediaHandler) RegisterRoutes(r chi.Router, authMiddleware *middlewarego.AuthMiddleware) {
	r.Route("/media", func(r chi.Router) {
		r.Use(authMiddleware.RequireAuth())

		r.Post("/storage", h.UploadStorageAsset)
		r.Post("/stream/tus", h.CreateStreamUpload)
		r.Post("/stream/complete", h.CompleteStreamUpload)
		r.Get("/stream/videos/{videoID}/status", h.GetStreamVideoStatus)
	})

	r.Route("/admin/media", func(r chi.Router) {
		r.Use(authMiddleware.RequireAuth())
		r.Use(authMiddleware.RequireAdmin())

		r.Post("/storage", h.UploadStorageAsset)
		r.Post("/stream/tus", h.CreateStreamUpload)
		r.Post("/stream/complete", h.CompleteStreamUpload)
		r.Get("/stream/videos/{videoID}/status", h.GetStreamVideoStatus)
	})
}

func (h *MediaHandler) UploadStorageAsset(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	if err := r.ParseMultipartForm(50 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	defer file.Close()

	kind := domain.MediaAssetKind(strings.TrimSpace(r.FormValue("kind")))
	courseID, ok := optionalUUIDFormValue(w, r, "course_id")
	if !ok {
		return
	}
	lessonID, ok := optionalUUIDFormValue(w, r, "lesson_id")
	if !ok {
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	asset, err := h.mediaService.UploadToStorage(r.Context(), service.UploadMediaInput{
		OwnerId:      userID,
		CourseId:     courseID,
		LessonId:     lessonID,
		Kind:         kind,
		OriginalName: fileHeader.Filename,
		MimeType:     mimeType,
		SizeBytes:    fileHeader.Size,
		Body:         file,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, asset)
}

func (h *MediaHandler) CreateStreamUpload(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Title string `json:"title"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	credentials, err := h.mediaService.CreateStreamUpload(r.Context(), service.CreateStreamUploadInput{
		Title: request.Title,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, credentials)
}

func (h *MediaHandler) CompleteStreamUpload(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	var request struct {
		CourseId  *uuid.UUID `json:"course_id"`
		LessonId  *uuid.UUID `json:"lesson_id"`
		VideoId   string     `json:"video_id"`
		Title     string     `json:"title"`
		SizeBytes int64      `json:"size_bytes"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	asset, err := h.mediaService.CompleteStreamUpload(r.Context(), service.CompleteStreamUploadInput{
		OwnerId:   userID,
		CourseId:  request.CourseId,
		LessonId:  request.LessonId,
		VideoId:   request.VideoId,
		Title:     request.Title,
		SizeBytes: request.SizeBytes,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, asset)
}

func (h *MediaHandler) GetStreamVideoStatus(w http.ResponseWriter, r *http.Request) {
	status, err := h.mediaService.GetStreamVideoStatus(r.Context(), chi.URLParam(r, "videoID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, status)
}

func optionalUUIDFormValue(w http.ResponseWriter, r *http.Request, name string) (*uuid.UUID, bool) {
	value := strings.TrimSpace(r.FormValue(name))
	if value == "" {
		return nil, true
	}

	id, err := uuid.Parse(value)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return nil, false
	}

	return &id, true
}
