package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	middlewarego "speaker_course/internal/middleware.go"
	"speaker_course/internal/service"

	"github.com/go-chi/chi/v5"
)

type NotificationsHandler struct {
	notificationsService *service.NotificationsService
}

func NewNotificationsHandler(notificationsService *service.NotificationsService) *NotificationsHandler {
	return &NotificationsHandler{notificationsService: notificationsService}
}

func (h *NotificationsHandler) RegisterRoutes(r chi.Router, authMiddleware *middlewarego.AuthMiddleware) {
	r.Route("/notifications", func(r chi.Router) {
		r.Use(authMiddleware.RequireAuth())

		r.Get("/", h.List)
		r.Get("/unread-count", h.CountUnread)
		r.Get("/stream", h.Stream)
		r.Patch("/read", h.MarkAllRead)
		r.Patch("/{notificationID}/read", h.MarkRead)
		r.Delete("/{notificationID}", h.Delete)
	})
}

func (h *NotificationsHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	notifications, err := h.notificationsService.ListByUser(r.Context(), userID, limit)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, notifications)
}

func (h *NotificationsHandler) CountUnread(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	count, err := h.notificationsService.CountUnread(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"count": count})
}

func (h *NotificationsHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	if err := h.notificationsService.MarkAllRead(r.Context(), userID); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *NotificationsHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	notificationID, ok := parseUUIDParam(w, r, "notificationID")
	if !ok {
		return
	}

	notification, err := h.notificationsService.MarkRead(r.Context(), notificationID, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if notification == nil {
		writeError(w, http.StatusNotFound, nil)
		return
	}

	writeJSON(w, http.StatusOK, notification)
}

func (h *NotificationsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	notificationID, ok := parseUUIDParam(w, r, "notificationID")
	if !ok {
		return
	}

	if err := h.notificationsService.Delete(r.Context(), notificationID, userID); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *NotificationsHandler) Stream(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewarego.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, nil)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, nil)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	events, unsubscribe := h.notificationsService.Subscribe(userID)
	defer unsubscribe()

	_, _ = fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case notification := <-events:
			payload, err := json.Marshal(notification)
			if err != nil {
				continue
			}
			_, _ = fmt.Fprintf(w, "event: notification\ndata: %s\n\n", payload)
			flusher.Flush()
		}
	}
}
