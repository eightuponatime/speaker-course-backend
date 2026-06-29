import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  Gauge,
  CheckCircle2,
  Eye,
  EyeOff,
  Instagram,
  MessageCircle,
  LogIn,
  LogOut,
  UserRound,
  X
} from "lucide-react";

import {
  getMyPrimaryCourseEnrollment,
  getPrimaryCourse,
  getPrimaryCourseProgram,
  requestPrimaryCourseEnrollment
} from "../api/courseDatasource";
import { forgotPassword } from "../api/authDatasource";
import { apiBaseUrl } from "../api/http";
import logosVoiceLogo from "../../assets/images/transparent_logo.png";
import type { CourseProgramSection } from "../api/courseDatasource";
import type { Course, CourseEnrollment, User } from "../entities/course/course";
import type { Notification } from "../entities/notification/notification";
import type { TranslationKey } from "../i18n";
import { NotificationBell } from "./NotificationBell";
import aboutProgramImage from "../../assets/images/about_program.png";
import affectionIcon from "../../assets/images/affection.png";
import clearSpeechIcon from "../../assets/images/clear_speach.png";
import confidenceIcon from "../../assets/images/confidence.png";
import professionalGrowthIcon from "../../assets/images/prof_grow.png";
import durationIcon from "../../assets/images/duration.png";
import experienceIcon from "../../assets/images/experience.png";
import liveLessonsIcon from "../../assets/images/live_lessons.png";

type LandingPageProps = {
  error: string;
  t: (key: TranslationKey) => string;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (input: { email: string; password: string; fullName: string }) => Promise<User>;
  currentUser?: User | null;
  onAdminOpen?: () => void;
  onLogout?: () => void;
  onOpenCourse?: () => void;
  onProfileOpen?: () => void;
  onNotificationOpen?: (notification: Notification) => void;
  onClearError?: () => void;
};

export function LandingPage({
  error,
  t,
  onLogin,
  onRegister,
  currentUser,
  onAdminOpen,
  onLogout,
  onOpenCourse,
  onProfileOpen,
  onNotificationOpen,
  onClearError
}: LandingPageProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerFullName, setRegisterFullName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [dialogEmail, setDialogEmail] = useState("");
  const [dialogPassword, setDialogPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showDialogPassword, setShowDialogPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [authNoticeDialogOpen, setAuthNoticeDialogOpen] = useState(false);
  const [programSections, setProgramSections] = useState<CourseProgramSection[]>([]);
  useEffect(() => {
    getPrimaryCourse()
      .then(setCourse)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isGoogleAccountNotFoundError(error)) return;

    setMode("register");
    setAuthNotice("Такой Google-аккаунт еще не зарегистрирован. Запишитесь на курс через эту вкладку.");
    setAuthNoticeDialogOpen(true);
    onClearError?.();
    setLoginDialogOpen(false);
    setForgotStatus("");
    setForgotSuccess(false);
    setForgotDialogOpen(false);
    setAccessError("");
  }, [error]);

  useEffect(() => {
    let cancelled = false;

    async function loadEnrollment() {
      if (!currentUser || currentUser.role === "admin") {
        setEnrollment(null);
        return;
      }

      setAccessLoading(true);
      setAccessError("");

      try {
        const nextEnrollment = await getMyPrimaryCourseEnrollment();
        if (!cancelled) {
          setEnrollment(nextEnrollment);
        }
      } catch (err) {
        if (!cancelled) {
          setAccessError(formatError(err));
        }
      } finally {
        if (!cancelled) {
          setAccessLoading(false);
        }
      }
    }

    void loadEnrollment();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;

    async function loadProgramSections() {
      try {
        const program = await getPrimaryCourseProgram();
        if (!cancelled) {
          setProgramSections([...program.sections].sort((a, b) => a.position - b.position));
        }
      } catch {
        if (!cancelled) {
          setProgramSections([]);
        }
      }
    }

    void loadProgramSections();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        await onLogin(loginEmail, loginPassword);
      } else {
        await onRegister({ email: registerEmail, password: registerPassword, fullName: registerFullName });
        setAccessError("");
        const nextEnrollment = await requestPrimaryCourseEnrollment();
        setEnrollment(nextEnrollment);
      }
    } catch (err) {
      setAccessError(formatError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoginDialogSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onLogin(dialogEmail, dialogPassword);
      setLoginDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestAccess() {
    setAccessSubmitting(true);
    setAccessError("");

    try {
      const nextEnrollment = await requestPrimaryCourseEnrollment();
      setEnrollment(nextEnrollment);
    } catch (err) {
      setAccessError(formatError(err));
    } finally {
      setAccessSubmitting(false);
    }
  }

  function openForgotPassword(initialEmail = "") {
    setForgotEmail(initialEmail);
    setForgotStatus("");
    setForgotSuccess(false);
    setForgotDialogOpen(true);
  }

  async function handleForgotPassword(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = forgotEmail.trim();
    if (!normalizedEmail) return;

    setForgotSubmitting(true);
    setForgotStatus("");
    setForgotSuccess(false);

    try {
      await forgotPassword(normalizedEmail);
      setForgotSuccess(true);
      setForgotStatus("Если аккаунт найден, мы отправим временный пароль на указанную почту.");
    } catch (err) {
      setForgotStatus(formatError(err));
    } finally {
      setForgotSubmitting(false);
    }
  }

  function highlightSection(sectionId: string) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const target = section.querySelector<HTMLElement>("[data-section-heading]") || section;

    section.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("landing-heading-highlight");
    window.setTimeout(() => {
      target.classList.add("landing-heading-highlight");
    }, 80);
    window.setTimeout(() => {
      target.classList.remove("landing-heading-highlight");
    }, 1500);
  }

  function scrollToRegistration() {
    setMode("register");
    setAuthNotice("");
    setAuthNoticeDialogOpen(false);
    onClearError?.();
    setLoginDialogOpen(false);
    window.setTimeout(() => {
      document.getElementById("landing-application")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  const courseTitle = "Курсы ораторского мастерства";
  const courseDescription = "Риторика • Влияние • Публичная речь";
  const currentYear = new Date().getFullYear();
  const canSubmitAuth =
    mode === "login"
      ? loginEmail.trim().length > 0 && loginPassword.length > 0
      : registerEmail.trim().length > 0 && registerPassword.length > 0 && registerFullName.trim().length > 0;
  const canSubmitDialogLogin = dialogEmail.trim().length > 0 && dialogPassword.length > 0;
  const authError = authNotice || formatUserFacingError(error);
  const accessDisplayError = formatUserFacingError(accessError);
  const authForm = (
    <>
      <div className="landing-auth-header">
        <strong>{mode === "login" ? "Войти в кабинет" : "Начните обучение сегодня"}</strong>
        <span>
          {mode === "login"
            ? "Введите данные, чтобы вернуться к материалам"
            : ""}
        </span>
      </div>

      <div className="landing-auth-tabs">
        <button
          className={mode === "login" ? "active" : ""}
          type="button"
          onClick={() => {
            setMode("login");
            setAuthNotice("");
            setAuthNoticeDialogOpen(false);
            onClearError?.();
          }}
        >
          {t("signIn")}
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          type="button"
          onClick={() => {
            setMode("register");
            setAuthNotice("");
            setAuthNoticeDialogOpen(false);
            onClearError?.();
          }}
        >
          {t("requestAccess")}
        </button>
      </div>

      <div className="landing-field-stack">
        <label>
          <span>{t("email")}</span>
          <input
            autoComplete="email"
            value={mode === "login" ? loginEmail : registerEmail}
            onChange={(event) => {
              if (mode === "login") {
                setLoginEmail(event.target.value);
              } else {
                setRegisterEmail(event.target.value);
              }
              setAuthNotice("");
              setAuthNoticeDialogOpen(false);
              onClearError?.();
            }}
            type="email"
          />
        </label>

        <label>
          <span>{t("password")}</span>
          <PasswordInput
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={mode === "login" ? loginPassword : registerPassword}
            onChange={(value) => {
              if (mode === "login") {
                setLoginPassword(value);
              } else {
                setRegisterPassword(value);
              }
              setAuthNotice("");
              setAuthNoticeDialogOpen(false);
              onClearError?.();
            }}
            visible={mode === "login" ? showLoginPassword : showRegisterPassword}
            onToggle={() => {
              if (mode === "login") {
                setShowLoginPassword((value) => !value);
              } else {
                setShowRegisterPassword((value) => !value);
              }
            }}
          />
        </label>

        <label className="landing-name-field">
          <span>{t("name")}</span>
          <input
            autoComplete="name"
            tabIndex={mode === "register" ? 0 : -1}
            value={registerFullName}
            onChange={(event) => {
              setRegisterFullName(event.target.value);
              setAuthNotice("");
              setAuthNoticeDialogOpen(false);
              onClearError?.();
            }}
          />
        </label>
      </div>

      <button type="submit" disabled={submitting || !canSubmitAuth}>
        {submitting ? t("wait") : mode === "login" ? t("enterCourse") : "Оставить заявку"}
      </button>
      {mode === "login" ? (
        <button className="landing-forgot-button" type="button" onClick={() => openForgotPassword(loginEmail)}>
          Забыли пароль?
        </button>
      ) : null}
      <a
        className="landing-google"
        href={`${apiBaseUrl}${mode === "register" ? "/auth/google/enroll/start" : "/auth/google/start"}`}
      >
        <GoogleIcon />
        {mode === "register" ? "Записаться через Google" : t("continueWithGoogle")}
      </a>
      {authError ? <AuthAlert message={authError} /> : null}
    </>
  );
  const loginDialogForm = (
    <>
      <div className="landing-auth-header">
        <strong>Войти в кабинет</strong>
        <span>Введите данные, чтобы вернуться к материалам</span>
      </div>

      <div className="landing-field-stack">
        <label>
          <span>{t("email")}</span>
          <input
            autoComplete="email"
            value={dialogEmail}
            onChange={(event) => {
              setDialogEmail(event.target.value);
              setAuthNotice("");
              setAuthNoticeDialogOpen(false);
              onClearError?.();
            }}
            type="email"
          />
        </label>

        <label>
          <span>{t("password")}</span>
          <PasswordInput
            autoComplete="current-password"
            value={dialogPassword}
            onChange={(value) => {
              setDialogPassword(value);
              setAuthNotice("");
              setAuthNoticeDialogOpen(false);
              onClearError?.();
            }}
            visible={showDialogPassword}
            onToggle={() => setShowDialogPassword((value) => !value)}
          />
        </label>
      </div>

      <button type="submit" disabled={submitting || !canSubmitDialogLogin}>
        {submitting ? t("wait") : t("enterCourse")}
      </button>
      <button className="landing-forgot-button" type="button" onClick={() => openForgotPassword(dialogEmail)}>
        Забыли пароль?
      </button>
      <a className="landing-google" href={`${apiBaseUrl}/auth/google/start`}>
        <GoogleIcon />
        {t("continueWithGoogle")}
      </a>
      <button className="landing-auth-switch" type="button" onClick={scrollToRegistration}>
        Нет аккаунта? Запишитесь на курс
      </button>
      {authError ? <AuthAlert message={authError} /> : null}
    </>
  );

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Logos Voice">
          <img src={logosVoiceLogo} alt="" />
          <span>
            <strong>LOGOS</strong>
            <small>VOICE</small>
          </span>
        </a>

        <nav className="landing-menu" aria-label="Разделы лендинга">
          <button type="button" onClick={() => highlightSection("about")}>
            О курсе
          </button>
          <button type="button" onClick={() => highlightSection("program")}>
            Программа
          </button>
        </nav>

        <div className="landing-nav-actions">
          {currentUser ? (
            <>
              <NotificationBell emptyLabel={t("noNotifications")} onNotificationOpen={onNotificationOpen} />
              {onAdminOpen ? (
                <button className="landing-nav-button landing-icon-button" type="button" onClick={onAdminOpen} aria-label={t("adminPanel")}>
                  <Gauge size={18} strokeWidth={1.9} />
                  <span>{t("adminPanel")}</span>
                </button>
              ) : null}
              {onProfileOpen ? (
                <button className="landing-nav-button landing-icon-button" type="button" onClick={onProfileOpen} aria-label="Профиль">
                  <UserRound size={18} strokeWidth={1.9} />
                  <span>Профиль</span>
                </button>
              ) : null}
            </>
          ) : null}
          {!currentUser ? (
            <button
              className="landing-nav-button"
              type="button"
              aria-label={t("signIn")}
              onClick={() => {
                setLoginDialogOpen(true);
              }}
            >
              <LogIn size={18} strokeWidth={1.9} />
              <span>{t("signIn")}</span>
            </button>
          ) : null}
          {currentUser && onLogout ? (
            <button className="landing-nav-button landing-icon-button dark" type="button" onClick={onLogout} aria-label={t("logout")}>
              <LogOut size={18} strokeWidth={1.9} />
              <span>{t("logout")}</span>
            </button>
          ) : null}
        </div>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-copy">
          <span className="landing-kicker">Онлайн-курс</span>
          <h1>{courseTitle}</h1>
          <p>{courseDescription}</p>

          <div className="landing-hero-metrics">
            {heroMetrics.map((item) => (
              <div key={item.title}>
                <img src={item.icon} alt="" />
                <span>{item.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-hero-art" aria-hidden="true">
          <img src={logosVoiceLogo} alt="" />
        </div>

        {currentUser ? (
          <section className="landing-auth landing-status-card" id="landing-application">
            {currentUser.role === "admin" ? (
              <>
                <div className="landing-auth-header">
                  <span>{currentUser.email}</span>
                  <strong>{t("adminPanel")}</strong>
                </div>

                <div className="landing-status-actions">
                  <button type="button" onClick={onAdminOpen}>
                    {t("adminPanel")}
                  </button>
                  <button className="secondary" type="button" onClick={onOpenCourse}>
                    {t("enterCourse")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="landing-auth-header">
                  <span>{currentUser.email}</span>
                  <strong>{enrollment ? enrollmentLabel(enrollment.status, t) : t("accessRequestTitle")}</strong>
                </div>

                <p>{enrollment ? enrollmentText(enrollment.status, t) : t("accessRequestText")}</p>

                <div className="landing-status-actions">
                  {enrollment?.status === "approved" ? (
                    <button type="button" onClick={onOpenCourse}>
                      {t("enterCourse")}
                    </button>
                  ) : null}
                  {!enrollment ? (
                    <button type="button" onClick={handleRequestAccess} disabled={accessSubmitting || accessLoading}>
                      {accessSubmitting ? t("wait") : t("requestAccess")}
                    </button>
                  ) : null}
                  {enrollment?.status !== "approved" && enrollment ? (
                    <button className="secondary" type="button" onClick={onOpenCourse}>
                      {t("details")}
                    </button>
                  ) : null}
                </div>
              </>
            )}

            {accessDisplayError ? <AuthAlert message={accessDisplayError} /> : null}
          </section>
        ) : (
          <form
            className={`landing-auth ${mode === "register" ? "register" : "login"}`}
            id="landing-application"
            onSubmit={handleSubmit}
          >
            {authForm}
          </form>
        )}
      </section>

      {!currentUser && loginDialogOpen ? (
        <div className="landing-auth-dialog-backdrop" onMouseDown={() => setLoginDialogOpen(false)}>
          <form
            className="landing-auth landing-auth-dialog login"
            onSubmit={handleLoginDialogSubmit}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="landing-auth-dialog-close"
              type="button"
              aria-label="Закрыть"
              onClick={() => setLoginDialogOpen(false)}
            >
              <X size={20} strokeWidth={1.8} />
            </button>
            {loginDialogForm}
          </form>
        </div>
      ) : null}

      {!currentUser && forgotDialogOpen ? (
        <div className="landing-auth-dialog-backdrop" onMouseDown={() => setForgotDialogOpen(false)}>
          <form
            className="landing-forgot-dialog"
            onSubmit={handleForgotPassword}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="landing-auth-dialog-close"
              type="button"
              aria-label="Закрыть"
              onClick={() => setForgotDialogOpen(false)}
            >
              <X size={20} strokeWidth={1.8} />
            </button>
            <div className="landing-auth-header">
              <strong>Восстановить доступ</strong>
              <span>Укажите email аккаунта. Мы отправим временный пароль, если найдем такой аккаунт.</span>
            </div>
            <label>
              <span>{t("email")}</span>
              <input
                autoComplete="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                type="email"
                required
              />
            </label>
            <button type="submit" disabled={forgotSubmitting || !forgotEmail.trim()}>
              {forgotSubmitting ? t("wait") : "Отправить временный пароль"}
            </button>
            {forgotStatus ? (
              <p className={forgotSuccess ? "landing-forgot-success" : "landing-forgot-error"}>
                {formatUserFacingError(forgotStatus)}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}

      {!currentUser && authNoticeDialogOpen ? (
        <div className="landing-auth-dialog-backdrop" onMouseDown={() => setAuthNoticeDialogOpen(false)}>
          <section className="landing-forgot-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <button
              className="landing-auth-dialog-close"
              type="button"
              aria-label="Закрыть"
              onClick={() => setAuthNoticeDialogOpen(false)}
            >
              <X size={20} strokeWidth={1.8} />
            </button>
            <div className="landing-auth-header">
              <strong>Google-аккаунт не найден</strong>
              <span>Сначала запишитесь на курс через Google. После этого аккаунт появится в системе.</span>
            </div>
            <button type="button" onClick={() => setAuthNoticeDialogOpen(false)}>
              Перейти к записи
            </button>
          </section>
        </div>
      ) : null}

      <section className="landing-benefits" aria-label="Преимущества курса">
        {benefits.map((item) => (
          <article key={item.title}>
            <img src={item.icon} alt="" />
            <div>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="landing-about-panel" id="about">
        <div className="landing-about-copy">
          <span className="landing-kicker">О курсе</span>
          <h2 data-section-heading>Практика. Обратная связь. Реальный результат.</h2>
          <p>
            Курс построен на практике: каждую неделю вы будете выступать, получать обратную связь и улучшать навыки.
            Формат сочетает живые вебинары, разборы и домашние задания.
          </p>
          <ul className="landing-check-list">
            {["Индивидуальные занятия", "Разбор выступлений и обратная связь", "Поддержка куратора и сообщества"].map(
              (item) => (
                <li key={item}>
                  <CheckCircle2 size={20} strokeWidth={1.7} />
                  {item}
                </li>
              )
            )}
          </ul>
        </div>
        <div className="landing-about-art" aria-hidden="true">
          <img src={aboutProgramImage} alt="" />
        </div>
      </section>

      <section
        className="landing-program-showcase"
        id="program"
        style={{ "--program-count": Math.max(programSections.length, 1) } as CSSProperties}
      >
        <div className="landing-program-intro">
          <span className="landing-kicker">Программа курса</span>
          <h2 data-section-heading>
            {programSections.length > 0 ? (
              <>
                <span>
                  {programSections.length} {formatStageCount(programSections.length)}
                </span>{" "}
                <span>
                  к <em>уверенной</em> речи и <em>сильному</em> выступлению
                </span>
              </>
            ) : (
              "Программа курса"
            )}
          </h2>
        </div>

        {programSections.length > 0 ? (
          <div className="landing-program-flow">
            <div className="landing-program-cards">
              {programSections.map((section, index) => (
                <article className="landing-program-card" key={section.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{section.title}</strong>
                </article>
              ))}
            </div>
            <div className="landing-program-track" aria-hidden="true">
              {programSections.map((section) => (
                <span className="landing-program-dot" key={section.id} />
              ))}
            </div>
          </div>
        ) : (
          <p className="landing-program-empty">Программа скоро появится.</p>
        )}
      </section>

      <footer className="landing-contact">
        <div>
          <span className="landing-kicker">Связь</span>
          <h2>Напишите нам, если остались вопросы</h2>
          <p>Logos Voice, {currentYear}. Обучение голосу, речи и уверенным выступлениям.</p>
        </div>
        <div className="landing-contact-links">
          <a href="https://www.instagram.com/logosvoice.kz/" target="_blank" rel="noreferrer">
            <Instagram size={18} strokeWidth={1.8} />
            Instagram
          </a>
          <a href="https://wa.me/77080088807" target="_blank" rel="noreferrer">
            <MessageCircle size={18} strokeWidth={1.8} />
            WhatsApp
          </a>
        </div>
      </footer>
    </main>
  );
}

const heroMetrics = [
  { title: "4 недели практики", icon: durationIcon },
  { title: "Подходит для новичков и профи", icon: experienceIcon },
  { title: "Живые занятия и обратная связь", icon: liveLessonsIcon }
];

const benefits = [
  {
    title: "Уверенность в каждом выступлении",
    text: "Избавитесь от страха сцены и научитесь чувствовать себя свободно в любой ситуации.",
    icon: confidenceIcon
  },
  {
    title: "Влияние на аудиторию",
    text: "Научитесь убеждать, вдохновлять и удерживать внимание слушателей с первых секунд.",
    icon: affectionIcon
  },
  {
    title: "Чистая и сильная речь",
    text: "Поставите голос, улучшите дикцию и научитесь выражать мысли точно и понятно.",
    icon: clearSpeechIcon
  },
  {
    title: "Профессиональный рост",
    text: "Ораторское мастерство откроет новые возможности в карьере и бизнесе.",
    icon: professionalGrowthIcon
  }
];

function enrollmentLabel(status: CourseEnrollment["status"], t: (key: TranslationKey) => string): string {
  if (status === "approved") return t("approvedStatus");
  if (status === "pending") return t("pendingStatus");
  if (status === "rejected") return t("rejectedStatus");
  return t("revokedStatus");
}

function formatStageCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return "этап";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "этапа";
  return "этапов";
}

function enrollmentText(status: CourseEnrollment["status"], t: (key: TranslationKey) => string): string {
  if (status === "approved") return t("accessApprovedText");
  if (status === "pending") return t("accessPendingText");
  if (status === "rejected") return t("accessRejectedText");
  return t("accessRevokedText");
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}

function formatUserFacingError(message: string): string {
  const normalized = extractServerError(message).trim();
  if (!normalized) return "";

  const lower = normalized.toLowerCase();

  if (lower.includes("email is empty")) return "Введите email.";
  if (lower.includes("password is empty")) return "Введите пароль.";
  if (lower.includes("full name") && lower.includes("empty")) return "Введите имя.";
  if (lower.includes("email or password is incorrect")) return "Email или пароль указаны неверно.";
  if (lower.includes("password must contain at least 8 characters")) return "Пароль должен быть не короче 8 символов.";
  if (lower.includes("email already exists") || lower.includes("duplicate key")) return "Аккаунт с таким email уже существует.";
  if (lower.includes("google account is not registered")) {
    return "Аккаунт с таким Google еще не зарегистрирован. Перейдите во вкладку записи.";
  }
  if (lower.includes("forbidden")) return "Недостаточно прав для этого действия.";
  if (lower.includes("unauthorized")) return "Сессия истекла. Войдите снова.";
  if (lower.includes("failed to fetch")) return "Не удалось связаться с сервером. Проверьте подключение и попробуйте еще раз.";
  if (lower.includes("request failed")) return "Не удалось выполнить запрос. Попробуйте еще раз.";

  return normalized;
}

function extractServerError(message: string): string {
  if (!message) return "";

  try {
    const payload = JSON.parse(message) as { error?: unknown; message?: unknown };
    if (typeof payload.error === "string") return payload.error;
    if (typeof payload.message === "string") return payload.message;
  } catch {
    return message;
  }

  return message;
}

function isGoogleAccountNotFoundError(error: string): boolean {
  return error.includes("Аккаунт с таким Google еще не зарегистрирован");
}

function PasswordInput({
  value,
  onChange,
  autoComplete,
  visible,
  onToggle
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="landing-password-field">
      <input
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={visible ? "text" : "password"}
      />
      <button type="button" aria-label={visible ? "Скрыть пароль" : "Показать пароль"} onClick={onToggle}>
        {visible ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
      </button>
    </span>
  );
}

function AuthAlert({ message }: { message: string }) {
  return (
    <div className="landing-auth-alert" role="alert">
      {message}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
