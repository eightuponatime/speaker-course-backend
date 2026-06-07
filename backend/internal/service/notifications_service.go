package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"speaker_course/internal/domain"
	"speaker_course/internal/repository"

	"github.com/google/uuid"
)

var ErrInvalidNotification = errors.New("invalid notification")

type NotificationsService struct {
	rp          *repository.NotificationsRepository
	mu          sync.RWMutex
	subscribers map[uuid.UUID]map[chan domain.Notification]struct{}
}

func NewNotificationsService(rp *repository.NotificationsRepository) *NotificationsService {
	return &NotificationsService{
		rp:          rp,
		subscribers: make(map[uuid.UUID]map[chan domain.Notification]struct{}),
	}
}

func (s *NotificationsService) Create(
	ctx context.Context,
	input domain.CreateNotificationInput,
) (*domain.Notification, error) {
	if input.UserId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidNotification)
	}
	if !isNotificationType(input.Type) {
		return nil, fmt.Errorf("%w: unsupported type %q", ErrInvalidNotification, input.Type)
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Body = strings.TrimSpace(input.Body)
	if input.Title == "" {
		return nil, fmt.Errorf("%w: title is empty", ErrInvalidNotification)
	}

	notification, err := s.rp.Create(ctx, input)
	if err != nil {
		return nil, err
	}

	s.publish(*notification)
	return notification, nil
}

func (s *NotificationsService) ListByUser(
	ctx context.Context,
	userId uuid.UUID,
	limit int,
) ([]domain.Notification, error) {
	if userId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidNotification)
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	return s.rp.ListByUser(ctx, userId, limit)
}

func (s *NotificationsService) CountUnread(ctx context.Context, userId uuid.UUID) (int, error) {
	if userId == uuid.Nil {
		return 0, fmt.Errorf("%w: user_id is empty", ErrInvalidNotification)
	}

	return s.rp.CountUnread(ctx, userId)
}

func (s *NotificationsService) MarkAllRead(ctx context.Context, userId uuid.UUID) error {
	if userId == uuid.Nil {
		return fmt.Errorf("%w: user_id is empty", ErrInvalidNotification)
	}

	return s.rp.MarkAllRead(ctx, userId)
}

func (s *NotificationsService) MarkRead(
	ctx context.Context,
	notificationId uuid.UUID,
	userId uuid.UUID,
) (*domain.Notification, error) {
	if notificationId == uuid.Nil {
		return nil, fmt.Errorf("%w: notification_id is empty", ErrInvalidNotification)
	}
	if userId == uuid.Nil {
		return nil, fmt.Errorf("%w: user_id is empty", ErrInvalidNotification)
	}

	return s.rp.MarkRead(ctx, notificationId, userId)
}

func (s *NotificationsService) Delete(ctx context.Context, notificationId uuid.UUID, userId uuid.UUID) error {
	if notificationId == uuid.Nil {
		return fmt.Errorf("%w: notification_id is empty", ErrInvalidNotification)
	}
	if userId == uuid.Nil {
		return fmt.Errorf("%w: user_id is empty", ErrInvalidNotification)
	}

	return s.rp.Delete(ctx, notificationId, userId)
}

func (s *NotificationsService) Subscribe(userId uuid.UUID) (<-chan domain.Notification, func()) {
	ch := make(chan domain.Notification, 8)

	s.mu.Lock()
	if s.subscribers[userId] == nil {
		s.subscribers[userId] = make(map[chan domain.Notification]struct{})
	}
	s.subscribers[userId][ch] = struct{}{}
	s.mu.Unlock()

	return ch, func() {
		s.mu.Lock()
		delete(s.subscribers[userId], ch)
		if len(s.subscribers[userId]) == 0 {
			delete(s.subscribers, userId)
		}
		s.mu.Unlock()
		close(ch)
	}
}

func (s *NotificationsService) publish(notification domain.Notification) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for ch := range s.subscribers[notification.UserId] {
		select {
		case ch <- notification:
		default:
		}
	}
}

func isNotificationType(kind domain.NotificationType) bool {
	switch kind {
	case domain.NotificationCourseEnrollmentRequested,
		domain.NotificationCourseAccessApproved,
		domain.NotificationCourseAccessRejected,
		domain.NotificationCourseAccessRevoked,
		domain.NotificationCourseAccessRestored:
		return true
	default:
		return false
	}
}
