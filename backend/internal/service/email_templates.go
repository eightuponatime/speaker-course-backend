package service

import (
	"bytes"
	"html/template"
	"strings"
	"time"
)

type emailTemplateData struct {
	Title       string
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
<body style="margin:0;padding:0;background:#f2eee7;color:#2b2723;font-family:Arial,'Helvetica Neue',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{{.Preheader}}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2eee7;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffaf4;border:1px solid #d9cdbf;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:26px 30px 18px;border-bottom:1px solid #e3d8cb;">
              <div style="font-size:12px;letter-spacing:6px;text-transform:uppercase;color:#8b8177;font-weight:700;">Logos Voice</div>
              <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.1;font-weight:400;color:#2b2723;">{{.Title}}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 30px 28px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#5b534b;">{{.Greeting}}</p>
              <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#5b534b;">{{.Body}}</p>
              {{if .ButtonURL}}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                <tr>
                  <td style="background:#24201d;border-radius:10px;">
                    <a href="{{.ButtonURL}}" style="display:inline-block;padding:14px 22px;color:#fffaf4;text-decoration:none;font-size:15px;font-weight:700;">{{.ButtonLabel}}</a>
                  </td>
                </tr>
              </table>
              {{end}}
              {{if .Note}}
              <p style="margin:0;padding:14px 16px;border:1px solid #e3d8cb;border-radius:10px;background:#f7f1ea;font-size:14px;line-height:1.5;color:#6d6259;">{{.Note}}</p>
              {{end}}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 30px 22px;border-top:1px solid #e3d8cb;color:#8b8177;font-size:12px;line-height:1.5;">
              Это автоматическое письмо от Logos Voice. Если вы не отправляли заявку, просто проигнорируйте его.
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
		Title:       "Новая заявка на курс",
		Preheader:   "В админ-панели ожидает новая заявка.",
		Greeting:    greetingFor(adminName),
		Body:        body,
		ButtonLabel: "Открыть заявки",
		ButtonURL:   adminURL,
		Note:        "Письмо отправлено только реальным администраторам. Технический аккаунт Logos Voice не получает уведомления.",
	})
}

func EnrollmentReviewedEmail(to string, fullName string, courseTitle string, status string) SendEmailInput {
	title := "Статус доступа к курсу обновлен"
	body := `Статус вашей заявки на курс "` + courseTitle + `" обновлен.`
	note := ""

	switch status {
	case "approved":
		title = "Доступ к курсу открыт"
		body = `Администратор открыл вам доступ к курсу "` + courseTitle + `". Можно заходить в кабинет и начинать обучение.`
		note = "Срок доступа начнет отсчитываться с первого открытия курса."
	case "rejected":
		title = "Заявка на курс отклонена"
		body = `К сожалению, заявка на курс "` + courseTitle + `" была отклонена.`
	case "revoked":
		title = "Доступ к курсу закрыт"
		body = `Доступ к курсу "` + courseTitle + `" был закрыт администратором.`
	}

	return templatedEmail(to, emailTemplateData{
		Title:     title,
		Preheader: body,
		Greeting:  greetingFor(fullName),
		Body:      body,
		Note:      note,
	})
}

func CourseAccessExtendedEmail(to string, fullName string, courseTitle string, accessExpiresAt time.Time) SendEmailInput {
	date := accessExpiresAt.Format("02.01.2006")
	body := `Доступ к курсу "` + courseTitle + `" продлен до ` + date + `.`
	return templatedEmail(to, emailTemplateData{
		Title:     "Доступ к курсу продлен",
		Preheader: body,
		Greeting:  greetingFor(fullName),
		Body:      body,
		Note:      "Дата окончания доступа также отображается в верхней панели курса.",
	})
}

func TemporaryPasswordEmail(to string, fullName string, temporaryPassword string) SendEmailInput {
	body := "Мы создали временный пароль для входа в кабинет Logos Voice."
	return templatedEmail(to, emailTemplateData{
		Title:     "Временный пароль для входа",
		Preheader: "Используйте временный пароль для входа и затем смените его в профиле.",
		Greeting:  greetingFor(fullName),
		Body:      body,
		Note:      "Временный пароль: " + temporaryPassword + "\n\nПосле входа откройте настройки профиля и задайте новый пароль.",
	})
}

func templatedEmail(to string, data emailTemplateData) SendEmailInput {
	var html bytes.Buffer
	if err := template.Must(template.New("email").Parse(baseEmailTemplate)).Execute(&html, data); err != nil {
		html.Reset()
	}

	return SendEmailInput{
		To:      to,
		Subject: data.Title,
		Text:    plainTextEmail(data),
		HTML:    html.String(),
	}
}

func plainTextEmail(data emailTemplateData) string {
	parts := []string{data.Greeting, data.Body}
	if data.Note != "" {
		parts = append(parts, data.Note)
	}
	parts = append(parts, "Logos Voice")
	return strings.Join(parts, "\n\n")
}

func greetingFor(fullName string) string {
	fullName = strings.TrimSpace(fullName)
	if fullName == "" {
		return "Здравствуйте!"
	}
	return "Здравствуйте, " + fullName + "!"
}
