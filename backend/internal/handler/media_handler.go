package handler

import (
	"net/http"

	middlewarego "speaker_course/internal/middleware.go"
	"speaker_course/internal/service"

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
	r.Route("/admin", func(r chi.Router) {
		r.Use(authMiddleware.RequireAuth())
		r.Use(authMiddleware.RequireAdmin())

		r.Post("/videos", h.UploadVideo)
	})
}

func (h *MediaHandler) UploadVideo(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	if err := r.ParseMultipartForm(64 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	defer file.Close()

	courseID, ok := optionalUUIDFormValue(w, r, "course_id")
	if !ok {
		return
	}

	lessonID, ok := optionalUUIDFormValue(w, r, "lesson_id")
	if !ok {
		return
	}

	result, err := h.mediaService.UploadBunnyVideo(r.Context(), service.UploadBunnyVideoInput{
		OwnerId:  userID,
		CourseId: courseID,
		LessonId: lessonID,
		Title:    r.FormValue("title"),
		File:     file,
		Header:   header,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, result)
}

func optionalUUIDFormValue(w http.ResponseWriter, r *http.Request, name string) (*uuid.UUID, bool) {
	value := r.FormValue(name)
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
