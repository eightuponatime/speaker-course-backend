package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"speaker_course/config"
)

type EmailService struct {
	apiKey string
	from   string
	client *http.Client
}

type SendEmailInput struct {
	To      string
	Subject string
	Text    string
	HTML    string
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{
		apiKey: strings.TrimSpace(cfg.ResendAPIKey),
		from:   strings.TrimSpace(cfg.EmailFrom),
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *EmailService) Send(ctx context.Context, input SendEmailInput) error {
	if s == nil || s.apiKey == "" || s.from == "" {
		return nil
	}
	if strings.TrimSpace(input.To) == "" || strings.TrimSpace(input.Subject) == "" {
		return nil
	}

	payload := map[string]any{
		"from":    s.from,
		"to":      []string{input.To},
		"subject": input.Subject,
		"text":    input.Text,
	}
	if input.HTML != "" {
		payload["html"] = input.HTML
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+s.apiKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return nil
	}

	responseBody, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
	return fmt.Errorf("resend email failed: status %d: %s", response.StatusCode, strings.TrimSpace(string(responseBody)))
}
