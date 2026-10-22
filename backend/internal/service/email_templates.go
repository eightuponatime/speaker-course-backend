package service

import (
	"bytes"
	"html/template"
	"strings"
	"time"
)

type emailTemplateData struct {
	Title       string
	Subject     string
	Preheader   string
	Greeting    string
	Body        string
	Note        string
	ButtonLabel string
	ButtonURL   string
}

const baseEmailTemplate = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{.Title}}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;color:#ede8df;font-family:Arial,'Helvetica Neue',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{{.Preheader}}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#0a0a0b" style="background:#0a0a0b;padding:32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#141416" style="max-width:560px;background:#141416;border:1px solid #36363a;">
          <tr>
            <td style="padding:30px 30px 26px;border-bottom:1px solid #36363a;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <span style="display:inline-block;width:30px;height:30px;border:2px solid #ede8df;border-bottom-color:#c8102e;border-radius:50%;font-size:1px;line-height:1px;">&nbsp;</span>
                  </td>
                  <td style="vertical-align:middle;font-family:Arial,'Helvetica Neue',sans-serif;font-size:21px;font-weight:700;letter-spacing:7px;line-height:1;color:#ede8df;">UMBRA</td>
                </tr>
              </table>
              <p style="margin:22px 0 10px;font-size:11px;letter-spacing:3px;line-height:1.5;text-transform:uppercase;color:#c8102e;">ИСКУССТВО ВЛИЯНИЯ</p>
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;font-weight:400;color:#ede8df;">{{.Title}}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 30px 32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#ede8df;">{{.Greeting}}</p>
              <p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:#c9c4bb;">{{.Body}}</p>
              {{if .ButtonURL}}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr>
                  <td bgcolor="#c8102e" style="background:#c8102e;">
                    <a href="{{.ButtonURL}}" style="display:inline-block;padding:15px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">{{.ButtonLabel}}</a>
                  </td>
                </tr>
              </table>
              {{end}}
              {{if .Note}}
              <p style="margin:0;padding:16px 18px;border:1px solid #48484c;border-left:3px solid #c8102e;background:#0a0a0b;font-size:14px;line-height:1.55;white-space:pre-line;color:#c9c4bb;">{{.Note}}</p>
              {{end}}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 30px 22px;border-top:1px solid #36363a;color:#9a958d;font-size:12px;line-height:1.5;">
              Это автоматическое письмо UMBRA. Если оно пришло по ошибке, просто проигнорируйте его.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

func EnrollmentRequestedEmail(to string, fullName string, courseTitle string) SendEmailInput {
	greeting := greetingFor(fullName)
	body := `Мы получили вашу заявку на курс "` + courseTitle + `". Администратор проверит заявку и откроет доступ, если все в порядке.`
	return templatedEmail(to, emailTemplateData{
		Subject:   uniqueEmailSubject("Заявка получена", fullName, to),
		Title:     "Заявка на курс получена",
		Preheader: "Мы получили вашу заявку и скоро проверим доступ.",
		Greeting:  greeting,
		Body:      body,
		Note:      "После одобрения мы отправим отдельное письмо. Доступ на 1 месяц начнет отсчитываться с первого входа в курс.",
	})
}

func AdminEnrollmentRequestedEmail(to string, adminName string, studentName string, studentEmail string, courseTitle string, adminURL string) SendEmailInput {
	studentName = strings.TrimSpace(studentName)
	if studentName == "" {
		studentName = studentEmail
	}

	body := `Поступила новая заявка на курс "` + courseTitle + `" от ` + studentName + ` (` + studentEmail + `).`
	return templatedEmail(to, emailTemplateData{
		Subject:     uniqueEmailSubject("Новая заявка", studentName, studentEmail),
		Title:       "Новая заявка на курс",
		Preheader:   "В админ-панели ожидает новая заявка.",
		Greeting:    greetingFor(adminName),
		Body:        body,
		ButtonLabel: "Открыть заявки",
		ButtonURL:   adminURL,
	})
}

func EnrollmentReviewedEmail(to string, fullName string, courseTitle string, status string, landingURL string) SendEmailInput {
	title := "Статус доступа к курсу обновлен"
	body := `Статус вашей заявки на курс "` + courseTitle + `" обновлен.`
	note := ""
	buttonLabel := ""
	buttonURL := ""

	switch status {
	case "approved":
		title = "Доступ к курсу открыт"
		body = `Администратор открыл вам доступ к курсу "` + courseTitle + `". На сайте можно перейти в кабинет, когда будете готовы начать обучение.`
		note = "Срок доступа начнет отсчитываться с первого открытия самого курса."
		buttonLabel = "Открыть сайт"
		buttonURL = landingURL
	case "rejected":
		title = "Заявка на курс отклонена"
		body = `К сожалению, заявка на курс "` + courseTitle + `" была отклонена.`
	case "revoked":
		title = "Доступ к курсу закрыт"
		body = `Доступ к курсу "` + courseTitle + `" был закрыт администратором.`
	}

	return templatedEmail(to, emailTemplateData{
		Subject:     uniqueEmailSubject(title, fullName, to),
		Title:       title,
		Preheader:   body,
		Greeting:    greetingFor(fullName),
		Body:        body,
		Note:        note,
		ButtonLabel: buttonLabel,
		ButtonURL:   buttonURL,
	})
}

func CourseAccessExtendedEmail(to string, fullName string, courseTitle string, accessExpiresAt time.Time, siteURL string) SendEmailInput {
	date := accessExpiresAt.Format("02.01.2006")
	body := `Доступ к курсу "` + courseTitle + `" продлен до ` + date + `.`
	return templatedEmail(to, emailTemplateData{
		Subject:     uniqueEmailSubject("Доступ продлен", fullName, to),
		Title:       "Доступ к курсу продлен",
		Preheader:   body,
		Greeting:    greetingFor(fullName),
		Body:        body,
		Note:        "Дата окончания доступа также отображается в верхней панели курса.",
		ButtonLabel: "Перейти на сайт",
		ButtonURL:   siteURL,
	})
}

func TemporaryPasswordEmail(to string, fullName string, temporaryPassword string) SendEmailInput {
	body := "Мы создали временный пароль для входа в кабинет Umbra."
	return templatedEmail(to, emailTemplateData{
		Subject:   uniqueEmailSubject("Временный пароль", fullName, to),
		Title:     "Временный пароль для входа",
		Preheader: "Используйте временный пароль для входа и затем смените его в профиле.",
		Greeting:  greetingFor(fullName),
		Body:      body,
		Note:      "Временный пароль: " + temporaryPassword + "\n\nПосле входа откройте настройки профиля и задайте новый пароль.",
	})
}

func AdminLessonSubmissionEmail(
	to string,
	adminName string,
	studentName string,
	studentEmail string,
	courseTitle string,
	lessonTitle string,
	adminURL string,
	isFollowUp bool,
) SendEmailInput {
	studentName = strings.TrimSpace(studentName)
	if studentName == "" {
		studentName = studentEmail
	}

	title := "Новая работа ученика"
	body := studentName + ` отправил(а) работу по уроку "` + lessonTitle + `" курса "` + courseTitle + `".`
	preheader := "В админ-панели ожидает новая работа ученика."
	if isFollowUp {
		title = "Работа ученика обновлена"
		body = studentName + ` обновил(а) работу по уроку "` + lessonTitle + `" после реакции преподавателя.`
		preheader = "Ученик обновил работу после комментария или изменения статуса."
	}

	return templatedEmail(to, emailTemplateData{
		Subject:     uniqueEmailSubject(title, studentName, studentEmail),
		Title:       title,
		Preheader:   preheader,
		Greeting:    greetingFor(adminName),
		Body:        body,
		ButtonLabel: "Открыть задания",
		ButtonURL:   adminURL,
	})
}

func AdminLessonSubmissionCommentEmail(
	to string,
	adminName string,
	studentName string,
	studentEmail string,
	courseTitle string,
	lessonTitle string,
	adminURL string,
) SendEmailInput {
	studentName = strings.TrimSpace(studentName)
	if studentName == "" {
		studentName = studentEmail
	}

	body := studentName + ` добавил(а) комментарий к работе по уроку "` + lessonTitle + `" курса "` + courseTitle + `".`
	return templatedEmail(to, emailTemplateData{
		Subject:     uniqueEmailSubject("Комментарий ученика к работе", studentName, studentEmail),
		Title:       "Комментарий ученика к работе",
		Preheader:   "Ученик оставил комментарий к отправленной работе.",
		Greeting:    greetingFor(adminName),
		Body:        body,
		ButtonLabel: "Открыть задания",
		ButtonURL:   adminURL,
	})
}

func StudentLessonSubmissionStatusEmail(
	to string,
	fullName string,
	courseTitle string,
	lessonTitle string,
	status string,
	lessonURL string,
) SendEmailInput {
	statusLabel := lessonSubmissionStatusLabel(status)
	body := `Преподаватель обновил статус вашей работы по уроку "` + lessonTitle + `" курса "` + courseTitle + `": ` + statusLabel + `.`
	return templatedEmail(to, emailTemplateData{
		Subject:     uniqueEmailSubject("Статус задания обновлен", fullName, to),
		Title:       "Статус задания обновлен",
		Preheader:   "Преподаватель обновил статус вашей работы.",
		Greeting:    greetingFor(fullName),
		Body:        body,
		ButtonLabel: "Открыть задание",
		ButtonURL:   lessonURL,
	})
}

func StudentLessonSubmissionCommentEmail(
	to string,
	fullName string,
	courseTitle string,
	lessonTitle string,
	lessonURL string,
) SendEmailInput {
	body := `Преподаватель оставил комментарий к вашей работе по уроку "` + lessonTitle + `" курса "` + courseTitle + `".`
	return templatedEmail(to, emailTemplateData{
		Subject:     uniqueEmailSubject("Новый комментарий к заданию", fullName, to),
		Title:       "Новый комментарий к заданию",
		Preheader:   "Преподаватель оставил комментарий к вашей работе.",
		Greeting:    greetingFor(fullName),
		Body:        body,
		ButtonLabel: "Открыть задание",
		ButtonURL:   lessonURL,
	})
}

func templatedEmail(to string, data emailTemplateData) SendEmailInput {
	var html bytes.Buffer
	if err := template.Must(template.New("email").Parse(baseEmailTemplate)).Execute(&html, data); err != nil {
		html.Reset()
	}

	return SendEmailInput{
		To:      to,
		Subject: emailSubject(data),
		Text:    plainTextEmail(data),
		HTML:    html.String(),
	}
}

func emailSubject(data emailTemplateData) string {
	if strings.TrimSpace(data.Subject) != "" {
		return data.Subject
	}

	return data.Title
}

func uniqueEmailSubject(base string, fullName string, email string) string {
	recipient := strings.TrimSpace(fullName)
	if recipient == "" {
		recipient = strings.TrimSpace(email)
	}
	if recipient == "" {
		recipient = "пользователь"
	}

	return "UMBRA · " + base + " – " + recipient + " – " + time.Now().Format("02.01.2006 15:04")
}

func plainTextEmail(data emailTemplateData) string {
	parts := []string{data.Greeting, data.Body}
	if data.Note != "" {
		parts = append(parts, data.Note)
	}
	parts = append(parts, "UMBRA · Искусство влияния")
	return strings.Join(parts, "\n\n")
}

func greetingFor(fullName string) string {
	fullName = strings.TrimSpace(fullName)
	if fullName == "" {
		return "Здравствуйте!"
	}
	return "Здравствуйте, " + fullName + "!"
}

func lessonSubmissionStatusLabel(status string) string {
	switch status {
	case "accepted":
		return "принято"
	case "needs_revision":
		return "на доработку"
	case "pending":
		return "на рассмотрении"
	default:
		return "обновлен"
	}
}
