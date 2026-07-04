package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"speaker_course/internal/domain"
	"speaker_course/internal/repository"

	"github.com/google/uuid"
)

var ErrInvalidSubmission = errors.New("invalid submission")

type SubmissionsService struct {
	rp *repository.SubmissionsRepository
}

func NewSubmissionsService(rp *repository.SubmissionsRepository) *SubmissionsService {
	return &SubmissionsService{rp: rp}
}

func (s *SubmissionsService) Submit(
	ctx context.Context,
	lessonID uuid.UUID,
	userID uuid.UUID,
	body string,
	attachments []domain.SubmissionAttachment,
) (*domain.LessonSubmission, error) {
	if lessonID == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidSubmission)
	}
	if userID == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidSubmission)
	}
	body = strings.TrimSpace(body)
	payload, err := marshalAttachments(attachments)
	if err != nil {
		return nil, err
	}
	if body == "" && len(attachments) == 0 {
		return nil, fmt.Errorf("%w: body or attachments required", ErrInvalidSubmission)
	}
	existing, err := s.rp.GetByLessonAndUser(ctx, lessonID, userID)
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.Status == domain.LessonSubmissionStatusAccepted {
		return nil, fmt.Errorf("%w: accepted submission is readonly", ErrInvalidSubmission)
	}
	if existing != nil {
		teacherComments, err := s.rp.CountTeacherComments(ctx, existing.Id)
		if err != nil {
			return nil, err
		}
		if teacherComments > 0 {
			return s.rp.UpdateWithRevision(ctx, existing.Id, userID, body, payload)
		}
	}
	return s.rp.Upsert(ctx, lessonID, userID, body, payload)
}

func (s *SubmissionsService) GetMineByLesson(
	ctx context.Context,
	lessonID uuid.UUID,
	userID uuid.UUID,
) (*domain.LessonSubmissionDetail, error) {
	submission, err := s.rp.GetByLessonAndUser(ctx, lessonID, userID)
	if err != nil || submission == nil {
		return nil, err
	}
	_ = s.rp.MarkViewedByStudent(ctx, submission.Id, userID)
	comments, err := s.rp.ListComments(ctx, submission.Id)
	if err != nil {
		return nil, err
	}
	revisions, err := s.rp.ListRevisions(ctx, submission.Id)
	if err != nil {
		return nil, err
	}
	return &domain.LessonSubmissionDetail{Submission: *submission, Comments: comments, Revisions: revisions}, nil
}

func (s *SubmissionsService) ListMineByCourse(
	ctx context.Context,
	courseID uuid.UUID,
	userID uuid.UUID,
) ([]domain.LessonSubmissionSummary, error) {
	return s.rp.ListMineByCourse(ctx, courseID, userID)
}

func (s *SubmissionsService) CancelPending(
	ctx context.Context,
	lessonID uuid.UUID,
	userID uuid.UUID,
) (*domain.LessonSubmission, error) {
	if lessonID == uuid.Nil {
		return nil, fmt.Errorf("%w: lesson_id is empty", ErrInvalidSubmission)
	}
	if userID == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidSubmission)
	}
	submission, err := s.rp.GetByLessonAndUser(ctx, lessonID, userID)
	if err != nil || submission == nil {
		return submission, err
	}
	teacherComments, err := s.rp.CountTeacherComments(ctx, submission.Id)
	if err != nil {
		return nil, err
	}
	if teacherComments > 0 {
		return nil, fmt.Errorf("%w: submission has teacher comments", ErrInvalidSubmission)
	}
	return s.rp.DeletePendingByLessonAndUser(ctx, lessonID, userID)
}

func (s *SubmissionsService) ListAdminByCourse(
	ctx context.Context,
	courseID uuid.UUID,
) ([]domain.AdminLessonSubmissionListItem, error) {
	return s.rp.ListAdminByCourse(ctx, courseID)
}

func (s *SubmissionsService) CountUnreadForAdmin(ctx context.Context, courseID uuid.UUID) (int, error) {
	return s.rp.CountUnreadForAdmin(ctx, courseID)
}

func (s *SubmissionsService) GetAdminDetail(
	ctx context.Context,
	submissionID uuid.UUID,
) (*domain.LessonSubmissionDetail, error) {
	submission, err := s.rp.GetByID(ctx, submissionID)
	if err != nil || submission == nil {
		return nil, err
	}
	_ = s.rp.MarkViewedByAdmin(ctx, submissionID)
	comments, err := s.rp.ListComments(ctx, submissionID)
	if err != nil {
		return nil, err
	}
	revisions, err := s.rp.ListRevisions(ctx, submissionID)
	if err != nil {
		return nil, err
	}
	return &domain.LessonSubmissionDetail{Submission: *submission, Comments: comments, Revisions: revisions}, nil
}

func (s *SubmissionsService) GetByID(
	ctx context.Context,
	submissionID uuid.UUID,
) (*domain.LessonSubmission, error) {
	if submissionID == uuid.Nil {
		return nil, fmt.Errorf("%w: submission_id is empty", ErrInvalidSubmission)
	}
	return s.rp.GetByID(ctx, submissionID)
}

func (s *SubmissionsService) GetByLessonAndUser(
	ctx context.Context,
	lessonID uuid.UUID,
	userID uuid.UUID,
) (*domain.LessonSubmission, error) {
	if lessonID == uuid.Nil || userID == uuid.Nil {
		return nil, fmt.Errorf("%w: id is empty", ErrInvalidSubmission)
	}
	return s.rp.GetByLessonAndUser(ctx, lessonID, userID)
}

func (s *SubmissionsService) CountTeacherComments(ctx context.Context, submissionID uuid.UUID) (int, error) {
	if submissionID == uuid.Nil {
		return 0, fmt.Errorf("%w: submission_id is empty", ErrInvalidSubmission)
	}
	return s.rp.CountTeacherComments(ctx, submissionID)
}

func (s *SubmissionsService) AddComment(
	ctx context.Context,
	submissionID uuid.UUID,
	authorID uuid.UUID,
	authorIsAdmin bool,
	body string,
	attachments []domain.SubmissionAttachment,
) (*domain.LessonSubmissionComment, error) {
	if submissionID == uuid.Nil || authorID == uuid.Nil {
		return nil, fmt.Errorf("%w: id is empty", ErrInvalidSubmission)
	}
	body = strings.TrimSpace(body)
	payload, err := marshalAttachments(attachments)
	if err != nil {
		return nil, err
	}
	if body == "" && len(attachments) == 0 {
		return nil, fmt.Errorf("%w: body or attachments required", ErrInvalidSubmission)
	}
	submission, err := s.rp.GetByID(ctx, submissionID)
	if err != nil {
		return nil, err
	}
	if submission != nil && submission.Status == domain.LessonSubmissionStatusAccepted {
		return nil, fmt.Errorf("%w: accepted submission is readonly", ErrInvalidSubmission)
	}
	return s.rp.AddComment(ctx, submissionID, authorID, body, payload, authorIsAdmin)
}

func (s *SubmissionsService) UpdateStatus(
	ctx context.Context,
	submissionID uuid.UUID,
	status domain.LessonSubmissionStatus,
	adminID uuid.UUID,
) (*domain.LessonSubmission, error) {
	if status != domain.LessonSubmissionStatusPending &&
		status != domain.LessonSubmissionStatusAccepted &&
		status != domain.LessonSubmissionStatusNeedsRevision {
		return nil, fmt.Errorf("%w: unsupported status", ErrInvalidSubmission)
	}
	return s.rp.UpdateStatus(ctx, submissionID, status, adminID)
}

func marshalAttachments(attachments []domain.SubmissionAttachment) ([]byte, error) {
	cleaned := make([]domain.SubmissionAttachment, 0, len(attachments))
	for _, attachment := range attachments {
		attachment.URL = strings.TrimSpace(attachment.URL)
		attachment.Name = strings.TrimSpace(attachment.Name)
		attachment.Kind = strings.TrimSpace(attachment.Kind)
		if attachment.URL == "" {
			continue
		}
		if attachment.Name == "" {
			attachment.Name = "Файл"
		}
		if attachment.Kind == "" {
			attachment.Kind = "file"
		}
		cleaned = append(cleaned, attachment)
	}

	payload, err := json.Marshal(cleaned)
	if err != nil {
		return nil, err
	}
	return payload, nil
}
