package service

import (
	"strings"
	"testing"
)

func TestEmailTemplateUsesUmbraBrandAndEscapesContent(t *testing.T) {
	email := templatedEmail("student@example.com", emailTemplateData{
		Title:       "Доступ открыт",
		Greeting:    "Здравствуйте!",
		Body:        `Курс <script>alert("x")</script> доступен.`,
		ButtonLabel: "Открыть курс",
		ButtonURL:   "https://umbra.kz/course?lesson_id=1&section=assignment",
	})

	for _, expected := range []string{"UMBRA", "#0a0a0b", "#c8102e", "ИСКУССТВО ВЛИЯНИЯ", "Открыть курс"} {
		if !strings.Contains(email.HTML, expected) {
			t.Errorf("HTML email does not contain %q", expected)
		}
	}
	if strings.Contains(email.HTML, "LOGOS") || strings.Contains(email.HTML, "<script>") {
		t.Error("HTML email contains legacy branding or unescaped content")
	}
	if !strings.Contains(email.HTML, "lesson_id=1&amp;section=assignment") {
		t.Error("HTML email does not escape the button URL")
	}
	if !strings.Contains(email.Text, "UMBRA · Искусство влияния") {
		t.Error("plain text email is missing the UMBRA signature")
	}
}
