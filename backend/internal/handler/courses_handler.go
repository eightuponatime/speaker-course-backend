package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"speaker_course/config"
	"speaker_course/internal/domain"
	middlewarego "speaker_course/internal/middleware.go"
	"speaker_course/internal/service"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type CoursesHandler struct {
	cfg                    *config.Config
	coursesService         *service.CoursesService
	enrollmentsService     *service.EnrollmentsService
	invitationCodesService *service.InvitationCodesService
	notificationsService   *service.NotificationsService
	quizResponsesService   *service.QuizResponsesService
	submissionsService     *service.SubmissionsService
	activityService        *service.ActivityService
	usersService           *service.UsersService
	emailService           *service.EmailService
}

func NewCoursesHandler(
	cfg *config.Config,
	coursesService *service.CoursesService,
	enrollmentsService *service.EnrollmentsService,
	invitationCodesService *service.InvitationCodesService,
	notificationsService *service.NotificationsService,
	quizResponsesService *service.QuizResponsesService,
	submissionsService *service.SubmissionsService,
	activityService *service.ActivityService,
	usersService *service.UsersService,
	emailService *service.EmailService,
) *CoursesHandler {
	return &CoursesHandler{
		cfg:                    cfg,
		coursesService:         coursesService,
		enrollmentsService:     enrollmentsService,
		invitationCodesService: invitationCodesService,
		notificationsService:   notificationsService,
		quizResponsesService:   quizResponsesService,
		submissionsService:     submissionsService,
		activityService:        activityService,
		usersService:           usersService,
		emailService:           emailService,
	}
}

func (h *CoursesHandler) RegisterRoutes(r chi.Router, authMiddleware *middlewarego.AuthMiddleware) {
	r.Get("/course", h.GetPrimaryCourse)
	r.Get("/course/program", h.GetPrimaryCourseProgram)
	r.Get("/courses/{slug}", h.GetCourseBySlug)
	r.Get("/courses/{slug}/program", h.GetCourseProgramBySlug)

	r.Group(func(r chi.Router) {
		r.Use(authMiddleware.RequireAuth())

		r.Get("/course/curriculum", h.GetPrimaryCourseCurriculum)
		r.Get("/course/enrollment/me", h.GetMyPrimaryCourseEnrollment)
		r.Post("/course/enrollments", h.RequestPrimaryCourseEnrollment)
		r.Get("/courses/{courseID}/curriculum", h.GetCurriculum)
		r.Get("/courses/{courseID}/enrollment/me", h.GetMyEnrollment)
		r.Post("/courses/{courseID}/enrollments", h.RequestEnrollment)
		r.Post("/courses/{courseID}/activity", h.TrackCourseActivity)
		r.Post("/courses/{courseID}/activity/offline", h.MarkCourseActivityOffline)
		r.Get("/lessons/{lessonID}/quiz-responses", h.ListMyLessonQuizResponses)
		r.Post("/lessons/{lessonID}/quiz-responses", h.SaveMyLessonQuizResponse)
		r.Get("/courses/{courseID}/submissions/me", h.ListMyLessonSubmissions)
		r.Get("/lessons/{lessonID}/submission", h.GetMyLessonSubmission)
		r.Post("/lessons/{lessonID}/submission", h.SubmitLessonSubmission)
		r.Post("/submissions/{submissionID}/comments", h.AddMySubmissionComment)

		admin := r.With(authMiddleware.RequireAdmin())
		admin.Post("/admin/courses", h.CreateCourse)
		admin.Get("/admin/course/curriculum", h.GetPrimaryCourseCurriculum)
		admin.Get("/admin/courses/{courseID}/curriculum", h.GetCurriculum)
		admin.Patch("/admin/courses/{courseID}", h.UpdateCourse)
		admin.Post("/admin/courses/{courseID}/publish", h.PublishCourse)
		admin.Post("/admin/courses/{courseID}/sections", h.CreateSection)
		admin.Patch("/admin/courses/{courseID}/sections/{sectionID}", h.UpdateSection)
		admin.Delete("/admin/courses/{courseID}/sections/{sectionID}", h.DeleteSection)
		admin.Post("/admin/courses/{courseID}/sections/{sectionID}/lessons", h.CreateLesson)
		admin.Patch("/admin/courses/{courseID}/lessons/reorder", h.ReorderLessons)
		admin.Get("/admin/courses/{courseID}/enrollments", h.ListEnrollments)
		admin.Get("/admin/courses/{courseID}/invitation-codes", h.ListInvitationCodes)
		admin.Post("/admin/courses/{courseID}/invitation-codes", h.GenerateInvitationCode)
		admin.Get("/admin/courses/{courseID}/student-activity", h.ListCourseStudentActivity)
		admin.Get("/admin/courses/{courseID}/students/{userID}/lesson-history", h.ListStudentLessonHistory)
		admin.Patch("/admin/courses/{courseID}/students/{userID}/access", h.ExtendStudentCourseAccess)
		admin.Get("/admin/courses/{courseID}/users", h.ListCourseUsers)
		admin.Patch("/admin/courses/{courseID}/users/{userID}/role", h.UpdateCourseUserRole)
		admin.Patch("/admin/lessons/{lessonID}", h.UpdateLesson)
		admin.Delete("/admin/lessons/{lessonID}", h.DeleteLesson)
		admin.Patch("/admin/lessons/{lessonID}/draft", h.SaveLessonDraft)
		admin.Post("/admin/lessons/{lessonID}/publish", h.PublishLesson)
		admin.Get("/admin/lessons/{lessonID}/quiz-responses", h.ListLessonQuizResponses)
		admin.Get("/admin/courses/{courseID}/submissions", h.ListAdminLessonSubmissions)
		admin.Get("/admin/courses/{courseID}/submissions/unread-count", h.CountAdminUnreadSubmissions)
		admin.Get("/admin/submissions/{submissionID}", h.GetAdminLessonSubmission)
		admin.Patch("/admin/submissions/{submissionID}/status", h.UpdateLessonSubmissionStatus)
		admin.Post("/admin/submissions/{submissionID}/comments", h.AddAdminSubmissionComment)
		admin.Patch("/admin/enrollments/{enrollmentID}/review", h.ReviewEnrollment)
	})
}

func (h *CoursesHandler) GetPrimaryCourse(w http.ResponseWriter, r *http.Request) {
	course, ok := h.primaryCourse(w, r)
	if !ok {
		return
	}

	writeJSON(w, http.StatusOK, course)
}

func (h *CoursesHandler) GetPrimaryCourseProgram(w http.ResponseWriter, r *http.Request) {
	course, ok := h.primaryCourse(w, r)
	if !ok {
		return
	}

	h.writeCourseProgram(w, r, course)
}

func (h *CoursesHandler) RequestPrimaryCourseEnrollment(w http.ResponseWriter, r *http.Request) {
	course, ok := h.primaryCourse(w, r)
	if !ok {
		return
	}

	h.requestEnrollmentForCourse(w, r, course.Id)
}

func (h *CoursesHandler) GetMyPrimaryCourseEnrollment(w http.ResponseWriter, r *http.Request) {
	course, ok := h.primaryCourse(w, r)
	if !ok {
		return
	}

	h.getMyEnrollmentForCourse(w, r, course.Id)
}

func (h *CoursesHandler) GetPrimaryCourseCurriculum(w http.ResponseWriter, r *http.Request) {
	course, ok := h.primaryCourse(w, r)
	if !ok {
		return
	}

	h.getCurriculumForCourse(w, r, course.Id)
}

func (h *CoursesHandler) GetCourseProgramBySlug(w http.ResponseWriter, r *http.Request) {
	course, err := h.coursesService.GetCourseBySlug(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if course == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	h.writeCourseProgram(w, r, course)
}

func (h *CoursesHandler) writeCourseProgram(w http.ResponseWriter, r *http.Request, course *domain.Course) {
	curriculum, err := h.coursesService.GetCurriculum(r.Context(), course.Id)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if curriculum == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	type programSection struct {
		Id       string `json:"id"`
		Title    string `json:"title"`
		Position int    `json:"position"`
	}
	response := struct {
		CourseId  string           `json:"course_id"`
		Title     string           `json:"title"`
		Slug      string           `json:"slug"`
		Sections  []programSection `json:"sections"`
		Lessons   int              `json:"lessons"`
		Published bool             `json:"published"`
	}{
		CourseId:  course.Id.String(),
		Title:     course.Title,
		Slug:      course.Slug,
		Sections:  make([]programSection, 0, len(curriculum.Sections)),
		Published: course.Status == domain.CourseStatusPublished,
	}

	for _, section := range curriculum.Sections {
		response.Sections = append(response.Sections, programSection{
			Id:       section.Id.String(),
			Title:    section.Title,
			Position: section.Position,
		})
		response.Lessons += len(section.Lessons)
	}

	writeJSON(w, http.StatusOK, response)
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

func (h *CoursesHandler) UpdateCourse(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	var request struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	course, err := h.coursesService.UpdateCourse(r.Context(), domain.UpdateCourseInput{
		CourseId:    courseID,
		Title:       request.Title,
		Description: request.Description,
	})
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

	h.getCurriculumForCourse(w, r, courseID)
}

func (h *CoursesHandler) getCurriculumForCourse(w http.ResponseWriter, r *http.Request, courseID uuid.UUID) {
	var access *domain.CourseAccessWindow
	if !strings.HasPrefix(r.URL.Path, "/admin/") {
		userID, ok := middlewarego.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, nil)
			return
		}

		hasAccess, err := h.enrollmentsService.HasApprovedAccess(r.Context(), courseID, userID)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		if !hasAccess {
			writeError(w, http.StatusForbidden, nil)
			return
		}

		access, err = h.activityService.EnsureCourseAccessStarted(r.Context(), domain.MarkCourseActivityOfflineInput{
			CourseId: courseID,
			UserId:   userID,
		})
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		if access.IsExpired {
			writeError(w, http.StatusForbidden, nil)
			return
		}
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
	curriculum.Access = access

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

func (h *CoursesHandler) UpdateSection(w http.ResponseWriter, r *http.Request) {
	if _, ok := parseUUIDParam(w, r, "courseID"); !ok {
		return
	}
	sectionID, ok := parseUUIDParam(w, r, "sectionID")
	if !ok {
		return
	}

	var request struct {
		Title string `json:"title"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	section, err := h.coursesService.UpdateSection(r.Context(), domain.UpdateCourseSectionInput{
		SectionId: sectionID,
		Title:     request.Title,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if section == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, section)
}

func (h *CoursesHandler) DeleteSection(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}
	sectionID, ok := parseUUIDParam(w, r, "sectionID")
	if !ok {
		return
	}

	if err := h.coursesService.DeleteSection(r.Context(), courseID, sectionID); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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

func (h *CoursesHandler) DeleteLesson(w http.ResponseWriter, r *http.Request) {
	lessonID, ok := parseUUIDParam(w, r, "lessonID")
	if !ok {
		return
	}

	if err := h.coursesService.DeleteLesson(r.Context(), lessonID); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *CoursesHandler) ReorderLessons(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	var request struct {
		Lessons []struct {
			Id        uuid.UUID `json:"id"`
			SectionId uuid.UUID `json:"section_id"`
			Position  int       `json:"position"`
		} `json:"lessons"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	items := make([]domain.ReorderLessonInput, 0, len(request.Lessons))
	for _, lesson := range request.Lessons {
		items = append(items, domain.ReorderLessonInput{
			LessonId:  lesson.Id,
			SectionId: lesson.SectionId,
			Position:  lesson.Position,
		})
	}

	curriculum, err := h.coursesService.ReorderLessons(r.Context(), courseID, items)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, curriculum)
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

func (h *CoursesHandler) UpdateLesson(w http.ResponseWriter, r *http.Request) {
	lessonID, ok := parseUUIDParam(w, r, "lessonID")
	if !ok {
		return
	}

	var request struct {
		Title string `json:"title"`
		Slug  string `json:"slug"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	lesson, err := h.coursesService.UpdateLesson(r.Context(), domain.UpdateLessonInput{
		LessonId: lessonID,
		Title:    request.Title,
		Slug:     request.Slug,
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
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	h.requestEnrollmentForCourse(w, r, courseID)
}

func (h *CoursesHandler) requestEnrollmentForCourse(w http.ResponseWriter, r *http.Request, courseID uuid.UUID) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	existingEnrollment, err := h.enrollmentsService.GetByCourseAndUser(r.Context(), courseID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
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

	course, err := h.coursesService.GetCourseByID(r.Context(), courseID)
	if existingEnrollment == nil && err == nil && course != nil {
		h.notifyAdminsAboutEnrollmentRequest(r.Context(), userID, courseID, enrollment.Id, course.Title)
	}
	// Email requests are disabled: registration now happens through one-time invitation codes.
	// if existingEnrollment == nil && err == nil && course != nil {
	// 	h.emailCourseAccessRequested(r.Context(), userID, course.Title)
	// }

	writeJSON(w, http.StatusCreated, enrollment)
}

func (h *CoursesHandler) GetMyEnrollment(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	h.getMyEnrollmentForCourse(w, r, courseID)
}

func (h *CoursesHandler) getMyEnrollmentForCourse(w http.ResponseWriter, r *http.Request, courseID uuid.UUID) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	enrollment, err := h.enrollmentsService.GetByCourseAndUser(r.Context(), courseID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if enrollment == nil {
		writeJSON(w, http.StatusOK, nil)
		return
	}

	writeJSON(w, http.StatusOK, enrollment)
}

func (h *CoursesHandler) TrackCourseActivity(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	var request struct {
		LessonId uuid.UUID `json:"lesson_id"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	lesson, err := h.coursesService.GetLessonByID(r.Context(), request.LessonId)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if lesson == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}
	if lesson.CourseId != courseID {
		writeError(w, http.StatusForbidden, nil)
		return
	}

	hasAccess, err := h.enrollmentsService.HasApprovedAccess(r.Context(), courseID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if !hasAccess {
		writeError(w, http.StatusForbidden, nil)
		return
	}

	access, err := h.activityService.EnsureCourseAccessStarted(r.Context(), domain.MarkCourseActivityOfflineInput{
		CourseId: courseID,
		UserId:   userID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if access.IsExpired {
		writeError(w, http.StatusForbidden, nil)
		return
	}

	activity, err := h.activityService.TrackCourseActivity(r.Context(), domain.TrackCourseActivityInput{
		CourseId: courseID,
		UserId:   userID,
		LessonId: request.LessonId,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, activity)
}

func (h *CoursesHandler) MarkCourseActivityOffline(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	hasAccess, err := h.enrollmentsService.HasApprovedAccess(r.Context(), courseID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if !hasAccess {
		writeError(w, http.StatusForbidden, nil)
		return
	}

	if err := h.activityService.MarkCourseActivityOffline(r.Context(), domain.MarkCourseActivityOfflineInput{
		CourseId: courseID,
		UserId:   userID,
	}); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *CoursesHandler) ListCourseStudentActivity(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	activity, err := h.activityService.ListCourseStudentActivity(r.Context(), courseID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, activity)
}

func (h *CoursesHandler) ListStudentLessonHistory(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}
	userID, ok := parseUUIDParam(w, r, "userID")
	if !ok {
		return
	}

	items, err := h.activityService.ListLessonProgressHistory(r.Context(), courseID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, items)
}

func (h *CoursesHandler) ExtendStudentCourseAccess(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}
	userID, ok := parseUUIDParam(w, r, "userID")
	if !ok {
		return
	}

	var request struct {
		AccessExpiresAt string `json:"access_expires_at"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	expiresAt, err := time.Parse(time.RFC3339, request.AccessExpiresAt)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	access, err := h.activityService.ExtendCourseAccess(r.Context(), domain.ExtendCourseAccessInput{
		CourseId:        courseID,
		UserId:          userID,
		AccessExpiresAt: expiresAt,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	course, courseErr := h.coursesService.GetCourseByID(r.Context(), courseID)
	if courseErr == nil && course != nil {
		h.emailCourseAccessExtended(r.Context(), userID, course.Title, access.AccessExpiresAt)
	}

	writeJSON(w, http.StatusOK, access)
}

func (h *CoursesHandler) ListMyLessonQuizResponses(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	lessonID, ok := parseUUIDParam(w, r, "lessonID")
	if !ok {
		return
	}

	if !h.ensureLessonAccess(w, r, lessonID, userID) {
		return
	}

	responses, err := h.quizResponsesService.ListByLessonAndUser(r.Context(), lessonID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, responses)
}

func (h *CoursesHandler) SaveMyLessonQuizResponse(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	lessonID, ok := parseUUIDParam(w, r, "lessonID")
	if !ok {
		return
	}

	if !h.ensureLessonAccess(w, r, lessonID, userID) {
		return
	}

	var request struct {
		QuizId              string `json:"quiz_id"`
		SelectedOptionIndex int    `json:"selected_option_index"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	response, err := h.quizResponsesService.Save(r.Context(), domain.SaveLessonQuizResponseInput{
		LessonId:            lessonID,
		UserId:              userID,
		QuizId:              request.QuizId,
		SelectedOptionIndex: request.SelectedOptionIndex,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *CoursesHandler) ListLessonQuizResponses(w http.ResponseWriter, r *http.Request) {
	lessonID, ok := parseUUIDParam(w, r, "lessonID")
	if !ok {
		return
	}

	responses, err := h.quizResponsesService.ListByLesson(r.Context(), lessonID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, responses)
}

func (h *CoursesHandler) ListMyLessonSubmissions(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	items, err := h.submissionsService.ListMineByCourse(r.Context(), courseID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *CoursesHandler) GetMyLessonSubmission(w http.ResponseWriter, r *http.Request) {
	lessonID, ok := parseUUIDParam(w, r, "lessonID")
	if !ok {
		return
	}
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}
	if !h.ensureLessonAccess(w, r, lessonID, userID) {
		return
	}

	detail, err := h.submissionsService.GetMineByLesson(r.Context(), lessonID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (h *CoursesHandler) SubmitLessonSubmission(w http.ResponseWriter, r *http.Request) {
	lessonID, ok := parseUUIDParam(w, r, "lessonID")
	if !ok {
		return
	}
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}
	if !h.ensureLessonAccess(w, r, lessonID, userID) {
		return
	}

	var request lessonSubmissionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	submission, err := h.submissionsService.Submit(r.Context(), lessonID, userID, request.Body, request.Attachments)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, submission)
}

func (h *CoursesHandler) AddMySubmissionComment(w http.ResponseWriter, r *http.Request) {
	submissionID, ok := parseUUIDParam(w, r, "submissionID")
	if !ok {
		return
	}
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	var request lessonSubmissionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	comment, err := h.submissionsService.AddComment(r.Context(), submissionID, userID, false, request.Body, request.Attachments)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, comment)
}

func (h *CoursesHandler) ListAdminLessonSubmissions(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}
	items, err := h.submissionsService.ListAdminByCourse(r.Context(), courseID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *CoursesHandler) CountAdminUnreadSubmissions(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}
	count, err := h.submissionsService.CountUnreadForAdmin(r.Context(), courseID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"count": count})
}

func (h *CoursesHandler) GetAdminLessonSubmission(w http.ResponseWriter, r *http.Request) {
	submissionID, ok := parseUUIDParam(w, r, "submissionID")
	if !ok {
		return
	}
	detail, err := h.submissionsService.GetAdminDetail(r.Context(), submissionID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (h *CoursesHandler) UpdateLessonSubmissionStatus(w http.ResponseWriter, r *http.Request) {
	submissionID, ok := parseUUIDParam(w, r, "submissionID")
	if !ok {
		return
	}
	adminID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}
	var request struct {
		Status domain.LessonSubmissionStatus `json:"status"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	submission, err := h.submissionsService.UpdateStatus(r.Context(), submissionID, request.Status, adminID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, submission)
}

func (h *CoursesHandler) AddAdminSubmissionComment(w http.ResponseWriter, r *http.Request) {
	submissionID, ok := parseUUIDParam(w, r, "submissionID")
	if !ok {
		return
	}
	adminID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}
	var request lessonSubmissionRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	comment, err := h.submissionsService.AddComment(r.Context(), submissionID, adminID, true, request.Body, request.Attachments)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, comment)
}

type lessonSubmissionRequest struct {
	Body        string                        `json:"body"`
	Attachments []domain.SubmissionAttachment `json:"attachments"`
}

func (h *CoursesHandler) ensureLessonAccess(w http.ResponseWriter, r *http.Request, lessonID uuid.UUID, userID uuid.UUID) bool {
	lesson, err := h.coursesService.GetLessonByID(r.Context(), lessonID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return false
	}
	if lesson == nil {
		writeError(w, http.StatusNotFound, nil)
		return false
	}

	hasAccess, err := h.enrollmentsService.HasApprovedAccess(r.Context(), lesson.CourseId, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return false
	}
	if !hasAccess {
		writeError(w, http.StatusForbidden, nil)
		return false
	}

	access, err := h.activityService.EnsureCourseAccessStarted(r.Context(), domain.MarkCourseActivityOfflineInput{
		CourseId: lesson.CourseId,
		UserId:   userID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return false
	}
	if access.IsExpired {
		writeError(w, http.StatusForbidden, nil)
		return false
	}

	return true
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

func (h *CoursesHandler) ListInvitationCodes(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	codes, err := h.invitationCodesService.ListByCourse(r.Context(), courseID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, codes)
}

func (h *CoursesHandler) GenerateInvitationCode(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	code, err := h.invitationCodesService.Generate(r.Context(), courseID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, code)
}

func (h *CoursesHandler) ListCourseUsers(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}

	users, err := h.usersService.ListForAdmin(
		r.Context(),
		courseID,
		r.URL.Query().Get("search"),
		r.URL.Query().Get("role"),
		r.URL.Query().Get("enrollment_status"),
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, users)
}

func (h *CoursesHandler) UpdateCourseUserRole(w http.ResponseWriter, r *http.Request) {
	courseID, ok := parseUUIDParam(w, r, "courseID")
	if !ok {
		return
	}
	userID, ok := parseUUIDParam(w, r, "userID")
	if !ok {
		return
	}

	var request struct {
		Role domain.UserRole `json:"role"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	adminID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}
	adminUser, err := h.usersService.GetByID(r.Context(), adminID)
	if err != nil || adminUser == nil {
		writeError(w, http.StatusUnauthorized, err)
		return
	}
	targetUser, err := h.usersService.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if targetUser == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}
	if request.Role == domain.UserRoleOwner && adminUser.Role != domain.UserRoleOwner {
		writeError(w, http.StatusForbidden, nil)
		return
	}
	if targetUser.Role.IsAdmin() && request.Role == domain.UserRoleMember && adminUser.Role != domain.UserRoleOwner {
		writeError(w, http.StatusForbidden, nil)
		return
	}
	if targetUser.Id == adminUser.Id && targetUser.Role == domain.UserRoleOwner && request.Role != domain.UserRoleOwner {
		writeError(w, http.StatusForbidden, nil)
		return
	}

	user, err := h.usersService.UpdateRole(r.Context(), userID, request.Role)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	if user.Role.IsAdmin() {
		_ = h.enrollmentsService.DeleteByCourseAndUser(r.Context(), courseID, userID)
	}

	writeJSON(w, http.StatusOK, buildAuthUserResponse(user))
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

	currentEnrollment, err := h.enrollmentsService.GetByID(r.Context(), enrollmentID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if currentEnrollment == nil {
		writeError(w, http.StatusNotFound, nil)
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

	course, err := h.coursesService.GetCourseByID(r.Context(), enrollment.CourseId)
	if err == nil && course != nil {
		actorID := adminID
		courseID := enrollment.CourseId
		enrollmentID := enrollment.Id
		notificationType, title, body := reviewNotificationPayload(currentEnrollment.Status, enrollment.Status, course.Title)
		_, _ = h.notificationsService.Create(r.Context(), domain.CreateNotificationInput{
			UserId:       enrollment.UserId,
			ActorId:      &actorID,
			CourseId:     &courseID,
			EnrollmentId: &enrollmentID,
			Type:         notificationType,
			Title:        title,
			Body:         body,
		})
		// Email requests are disabled: registration now happens through one-time invitation codes.
		// h.emailCourseAccessReviewed(r.Context(), enrollment.UserId, course.Title, enrollment.Status)
	}

	writeJSON(w, http.StatusOK, enrollment)
}

func reviewNotificationPayload(
	previous domain.CourseEnrollmentStatus,
	next domain.CourseEnrollmentStatus,
	courseTitle string,
) (domain.NotificationType, string, string) {
	switch next {
	case domain.CourseEnrollmentStatusApproved:
		if previous == domain.CourseEnrollmentStatusRejected || previous == domain.CourseEnrollmentStatusRevoked {
			return domain.NotificationCourseAccessRestored,
				"Доступ к курсу восстановлен",
				"Доступ к " + courseTitle + " снова открыт."
		}

		return domain.NotificationCourseAccessApproved,
			"Доступ к курсу открыт",
			"Ваша заявка на " + courseTitle + " одобрена."
	case domain.CourseEnrollmentStatusRejected:
		return domain.NotificationCourseAccessRejected,
			"Заявка на курс отклонена",
			"Ваша заявка на " + courseTitle + " отклонена."
	case domain.CourseEnrollmentStatusRevoked:
		return domain.NotificationCourseAccessRevoked,
			"Доступ к курсу закрыт",
			"Доступ к " + courseTitle + " закрыт администратором."
	default:
		return domain.NotificationCourseAccessRejected,
			"Статус доступа обновлен",
			"Статус доступа к курсу обновлен."
	}
}

func (h *CoursesHandler) emailCourseAccessRequested(ctx context.Context, userID uuid.UUID, courseTitle string) {
	user, err := h.usersService.GetByID(ctx, userID)
	if err != nil || user == nil {
		return
	}

	_ = h.emailService.Send(ctx, service.EnrollmentRequestedEmail(user.Email, user.FullName, courseTitle))
}

func (h *CoursesHandler) notifyAdminsAboutEnrollmentRequest(
	ctx context.Context,
	actorID uuid.UUID,
	courseID uuid.UUID,
	enrollmentID uuid.UUID,
	courseTitle string,
) {
	admins, err := h.usersService.ListAdmins(ctx)
	if err != nil {
		return
	}
	student, _ := h.usersService.GetByID(ctx, actorID)
	studentEmail := ""
	studentName := ""
	if student != nil {
		studentEmail = student.Email
		studentName = student.FullName
	}
	studentLabel := strings.TrimSpace(studentName)
	if studentLabel == "" {
		studentLabel = studentEmail
	}

	for _, admin := range admins {
		if admin.Id == actorID || admin.Email == "system@logos-voice.local" {
			continue
		}

		_, _ = h.notificationsService.Create(ctx, domain.CreateNotificationInput{
			UserId:       admin.Id,
			ActorId:      &actorID,
			CourseId:     &courseID,
			EnrollmentId: &enrollmentID,
			Type:         domain.NotificationCourseEnrollmentRequested,
			Title:        "Новая заявка на курс",
			Body:         studentLabel + " отправил(а) заявку на " + courseTitle + ".",
		})
		// Email requests are disabled: registration now happens through one-time invitation codes.
		// _ = h.emailService.Send(ctx, service.AdminEnrollmentRequestedEmail(
		// 	admin.Email,
		// 	admin.FullName,
		// 	studentName,
		// 	studentEmail,
		// 	courseTitle,
		// 	h.cfg.FrontendURL+"/admin",
		// ))
	}
}

func (h *CoursesHandler) emailCourseAccessReviewed(
	ctx context.Context,
	userID uuid.UUID,
	courseTitle string,
	status domain.CourseEnrollmentStatus,
) {
	user, err := h.usersService.GetByID(ctx, userID)
	if err != nil || user == nil {
		return
	}

	_ = h.emailService.Send(ctx, service.EnrollmentReviewedEmail(
		user.Email,
		user.FullName,
		courseTitle,
		string(status),
		h.cfg.FrontendURL,
	))
}

func (h *CoursesHandler) emailCourseAccessExtended(
	ctx context.Context,
	userID uuid.UUID,
	courseTitle string,
	accessExpiresAt *time.Time,
) {
	user, err := h.usersService.GetByID(ctx, userID)
	if err != nil || user == nil || accessExpiresAt == nil {
		return
	}

	_ = h.emailService.Send(ctx, service.CourseAccessExtendedEmail(user.Email, user.FullName, courseTitle, *accessExpiresAt, h.cfg.FrontendURL))
}

func (h *CoursesHandler) primaryCourse(w http.ResponseWriter, r *http.Request) (*domain.Course, bool) {
	course, err := h.coursesService.GetPrimaryCourse(r.Context())
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return nil, false
	}
	if course == nil {
		writeError(w, http.StatusNotFound, nil)
		return nil, false
	}

	return course, true
}

func parseUUIDParam(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return uuid.Nil, false
	}

	return id, true
}
