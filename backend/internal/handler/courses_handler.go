package handler

import (
	"encoding/json"
	"net/http"

	"speaker_course/internal/domain"
	middlewarego "speaker_course/internal/middleware.go"
	"speaker_course/internal/service"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CoursesHandler struct {
	coursesService     *service.CoursesService
	enrollmentsService *service.EnrollmentsService
}

func NewCoursesHandler(
	coursesService *service.CoursesService,
	enrollmentsService *service.EnrollmentsService,
) *CoursesHandler {
	return &CoursesHandler{
		coursesService:     coursesService,
		enrollmentsService: enrollmentsService,
	}
}

func (h *CoursesHandler) RegisterRoutes(r chi.Router, authMiddleware *middlewarego.AuthMiddleware) {
	r.Get("/courses/{slug}", h.GetCourseBySlug)

	r.Group(func(r chi.Router) {
		r.Use(authMiddleware.RequireAuth())

		r.Post("/courses/{courseID}/enrollments", h.RequestEnrollment)

		r.Route("/admin", func(r chi.Router) {
			r.Use(authMiddleware.RequireAdmin())

			r.Post("/courses", h.CreateCourse)
			r.Get("/courses/{courseID}/curriculum", h.GetCurriculum)
			r.Post("/courses/{courseID}/publish", h.PublishCourse)
			r.Post("/courses/{courseID}/sections", h.CreateSection)
			r.Post("/courses/{courseID}/sections/{sectionID}/lessons", h.CreateLesson)
			r.Get("/courses/{courseID}/enrollments", h.ListEnrollments)
			r.Patch("/lessons/{lessonID}/draft", h.SaveLessonDraft)
			r.Post("/lessons/{lessonID}/publish", h.PublishLesson)
			r.Patch("/enrollments/{enrollmentID}/review", h.ReviewEnrollment)
		})
	})
}

func (h *CoursesHandler) GetCourseBySlug(w http.ResponseWriter, r *http.Request) {
	course, err := h.coursesService.GetCourseBySlug(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if course == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, course)
}

func (h *CoursesHandler) CreateCourse(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	var request struct {
		Title         string  `json:"title"`
		Slug          string  `json:"slug"`
		Description   string  `json:"description"`
		CoverImageURL *string `json:"cover_image_url"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	course, err := h.coursesService.CreateCourse(r.Context(), domain.CreateCourseInput{
		AuthorId:      userID,
		Title:         request.Title,
		Slug:          request.Slug,
		Description:   request.Description,
		CoverImageURL: request.CoverImageURL,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, course)
}

func (h *CoursesHandler) PublishCourse(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	course, err := h.coursesService.PublishCourse(r.Context(), courseID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if course == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, course)
}

func (h *CoursesHandler) GetCurriculum(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	curriculum, err := h.coursesService.GetCurriculum(r.Context(), courseID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if curriculum == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, curriculum)
}

func (h *CoursesHandler) CreateSection(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	var request struct {
		Title    string `json:"title"`
		Position int    `json:"position"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	section, err := h.coursesService.CreateSection(r.Context(), domain.CreateCourseSectionInput{
		CourseId: courseID,
		Title:    request.Title,
		Position: request.Position,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, section)
}

func (h *CoursesHandler) CreateLesson(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	sectionID, ok := parseUUIDParam(w, r, "sectionID")
	if !ok {
		return
	}

	var request struct {
		Title    string `json:"title"`
		Slug     string `json:"slug"`
		Position int    `json:"position"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	lesson, err := h.coursesService.CreateLesson(r.Context(), domain.CreateLessonInput{
		CourseId:  courseID,
		SectionId: sectionID,
		Title:     request.Title,
		Slug:      request.Slug,
		Position:  request.Position,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, lesson)
}

func (h *CoursesHandler) SaveLessonDraft(w http.ResponseWriter, r *http.Request) {
	lessonID, ok := parseUUIDParam(w, r, "lessonID")
	if !ok {
		return
	}

	var request struct {
		Content json.RawMessage `json:"content"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	lesson, err := h.coursesService.SaveLessonDraft(r.Context(), domain.UpdateLessonDraftContentInput{
		LessonId: lessonID,
		Content:  request.Content,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if lesson == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, lesson)
}

func (h *CoursesHandler) PublishLesson(w http.ResponseWriter, r *http.Request) {
	lessonID, ok := parseUUIDParam(w, r, "lessonID")
	if !ok {
		return
	}

	lesson, err := h.coursesService.PublishLesson(r.Context(), lessonID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if lesson == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, lesson)
}

func (h *CoursesHandler) RequestEnrollment(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	enrollment, err := h.enrollmentsService.RequestAccess(r.Context(), domain.CreateCourseEnrollmentInput{
		CourseId: courseID,
		UserId:   userID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, enrollment)
}

func (h *CoursesHandler) ListEnrollments(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	status := domain.CourseEnrollmentStatus(r.URL.Query().Get("status"))
	if status == "" {
		status = domain.CourseEnrollmentStatusPending
	}

	enrollments, err := h.enrollmentsService.ListByCourseAndStatus(r.Context(), courseID, status)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, enrollments)
}

func (h *CoursesHandler) ReviewEnrollment(w http.ResponseWriter, r *http.Request) {
	adminID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	enrollmentID, ok := parseUUIDParam(w, r, "enrollmentID")
	if !ok {
		return
	}

	var request struct {
		Status    domain.CourseEnrollmentStatus `json:"status"`
		AdminNote *string                       `json:"admin_note"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	enrollment, err := h.enrollmentsService.Review(r.Context(), domain.ReviewCourseEnrollmentInput{
		EnrollmentId: enrollmentID,
		Status:       request.Status,
		ReviewedBy:   adminID,
		AdminNote:    request.AdminNote,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if enrollment == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, enrollment)
}

func parseUUIDParam(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return uuid.Nil, false
	}

	return id, true
}
