package service

import (
	"strings"
	"testing"
	"time"
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

func TestCourseAccessExtendedEmailUsesUmbraTemplate(t *testing.T) {
	email := CourseAccessExtendedEmail(
		"student@example.com",
		"Maxim",
		"Курсы ораторского мастерства",
		time.Date(2027, time.February, 1, 0, 0, 0, 0, time.UTC),
		"https://umbra.kz",
	)

	for _, expected := range []string{"UMBRA", "Доступ к курсу продлен", "01.02.2027", "https://umbra.kz", "#0a0a0b"} {
		if !strings.Contains(email.HTML, expected) {
			t.Errorf("access extension email does not contain %q", expected)
		}
	}
	if strings.Contains(email.HTML, "Logos Voice") || strings.Contains(email.Text, "Logos Voice") {
		t.Error("access extension email contains legacy branding")
	}
}

func TestAllEmailTemplatesUseUmbraBrand(t *testing.T) {
	const siteURL = "https://umbra.kz"
	tests := []struct {
		name  string
		email SendEmailInput
	}{
		{"заявка ученика", EnrollmentRequestedEmail("student@example.com", "Maxim", "Курс")},
		{"заявка администратору", AdminEnrollmentRequestedEmail("admin@example.com", "Администратор", "Maxim", "student@example.com", "Курс", siteURL+"/admin")},
		{"доступ открыт", EnrollmentReviewedEmail("student@example.com", "Maxim", "Курс", "approved", siteURL)},
		{"доступ отклонён", EnrollmentReviewedEmail("student@example.com", "Maxim", "Курс", "rejected", siteURL)},
		{"доступ закрыт", EnrollmentReviewedEmail("student@example.com", "Maxim", "Курс", "revoked", siteURL)},
		{"доступ продлён", CourseAccessExtendedEmail("student@example.com", "Maxim", "Курс", time.Date(2027, 2, 1, 0, 0, 0, 0, time.UTC), siteURL)},
		{"временный пароль", TemporaryPasswordEmail("student@example.com", "Maxim", "example-password")},
		{"работа администратору", AdminLessonSubmissionEmail("admin@example.com", "Администратор", "Maxim", "student@example.com", "Курс", "Урок", siteURL+"/admin", false)},
		{"обновлённая работа", AdminLessonSubmissionEmail("admin@example.com", "Администратор", "Maxim", "student@example.com", "Курс", "Урок", siteURL+"/admin", true)},
		{"комментарий администратору", AdminLessonSubmissionCommentEmail("admin@example.com", "Администратор", "Maxim", "student@example.com", "Курс", "Урок", siteURL+"/admin")},
		{"статус задания", StudentLessonSubmissionStatusEmail("student@example.com", "Maxim", "Курс", "Урок", "accepted", siteURL+"/course")},
		{"комментарий ученику", StudentLessonSubmissionCommentEmail("student@example.com", "Maxim", "Курс", "Урок", siteURL+"/course")},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if !strings.Contains(test.email.HTML, "UMBRA") || !strings.Contains(test.email.HTML, "#0a0a0b") {
				t.Error("HTML email does not use the UMBRA template")
			}
			if !strings.Contains(test.email.Text, "UMBRA · Искусство влияния") || !strings.HasPrefix(test.email.Subject, "UMBRA · ") {
				t.Error("email text or subject does not use the UMBRA brand")
			}
			if strings.Contains(test.email.HTML, "Logos Voice") || strings.Contains(test.email.Text, "Logos Voice") {
				t.Error("email contains legacy branding")
			}
		})
	}
}
