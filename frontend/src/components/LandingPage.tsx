import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CheckCircle2,
  Flame,
  Instagram,
  MessageCircle,
  Mic2,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Volume2,
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
import type { TranslationKey } from "../i18n";
import { NotificationBell } from "./NotificationBell";

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
  onProfileOpen
}: LandingPageProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotStatus, setForgotStatus] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [programSections, setProgramSections] = useState<CourseProgramSection[]>([]);
  useEffect(() => {
    getPrimaryCourse()
      .then(setCourse)
      .catch(() => undefined);
  }, []);

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
        await onLogin(email, password);
      } else {
        await onRegister({ email, password, fullName });
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
      await onLogin(email, password);
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

  async function handleForgotPassword() {
    if (!email.trim()) {
      setForgotStatus("Введите email, чтобы получить временный пароль");
      return;
    }

    setForgotSubmitting(true);
    setForgotStatus("");

    try {
      await forgotPassword(email);
      setForgotStatus("Если аккаунт найден, временный пароль придет на email");
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
    setLoginDialogOpen(false);
    window.setTimeout(() => {
      document.getElementById("landing-application")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  const courseTitle = "Курсы ораторского мастерства";
  const courseDescription = "Риторика • Влияние • Публичная речь";
  const currentYear = new Date().getFullYear();
  const authForm = (
    <>
      <div className="landing-auth-header">
        <strong>{mode === "login" ? "Войти в кабинет" : "Начните обучение сегодня"}</strong>
        <span>
          {mode === "login"
            ? "Введите данные, чтобы вернуться к материалам"
            : "Оставьте заявку - мы свяжемся с вами для уточнения деталей"}
        </span>
      </div>

      <div className="landing-auth-tabs">
        <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
          {t("signIn")}
        </button>
        <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>
          {t("requestAccess")}
        </button>
      </div>

      <div className="landing-field-stack">
        <label>
          <span>{t("email")}</span>
          <input autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>

        <label>
          <span>{t("password")}</span>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </label>

        <label className="landing-name-field">
          <span>{t("name")}</span>
          <input
            autoComplete="name"
            tabIndex={mode === "register" ? 0 : -1}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? t("wait") : mode === "login" ? t("enterCourse") : "Оставить заявку"}
      </button>
      {mode === "login" ? (
        <button className="landing-forgot-button" type="button" disabled={forgotSubmitting} onClick={handleForgotPassword}>
          {forgotSubmitting ? t("wait") : "Забыли пароль?"}
        </button>
      ) : null}
      <a className="landing-google" href={`${apiBaseUrl}/auth/google/start`}>
        <GoogleIcon />
        {mode === "register" ? "Записаться через Google" : t("continueWithGoogle")}
      </a>
      {forgotStatus ? <p>{forgotStatus}</p> : null}
      {error ? <p>{error}</p> : null}
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
          <input autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>

        <label>
          <span>{t("password")}</span>
          <input
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </label>
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? t("wait") : t("enterCourse")}
      </button>
      <button className="landing-forgot-button" type="button" disabled={forgotSubmitting} onClick={handleForgotPassword}>
        {forgotSubmitting ? t("wait") : "Забыли пароль?"}
      </button>
      <a className="landing-google" href={`${apiBaseUrl}/auth/google/start`}>
        <GoogleIcon />
        {t("continueWithGoogle")}
      </a>
      <button className="landing-auth-switch" type="button" onClick={scrollToRegistration}>
        Нет аккаунта? Запишитесь на курс
      </button>
      {forgotStatus ? <p>{forgotStatus}</p> : null}
      {error ? <p>{error}</p> : null}
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
              <NotificationBell emptyLabel={t("noNotifications")} />
              {onAdminOpen ? (
                <button className="landing-nav-button" type="button" onClick={onAdminOpen}>
                  {t("adminPanel")}
                </button>
              ) : null}
              {onProfileOpen ? (
                <button className="landing-nav-button" type="button" onClick={onProfileOpen}>
                  Профиль
                </button>
              ) : null}
            </>
          ) : null}
          {!currentUser ? (
            <button
              className="landing-nav-button"
              type="button"
              onClick={() => {
                setLoginDialogOpen(true);
              }}
            >
              {t("signIn")}
            </button>
          ) : null}
          {currentUser && onLogout ? (
            <button className="landing-nav-button dark" type="button" onClick={onLogout}>
              {t("logout")}
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
                <item.icon size={24} strokeWidth={1.6} />
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

            {accessError ? <p>{accessError}</p> : null}
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

      <section className="landing-benefits" aria-label="Преимущества курса">
        {benefits.map((item) => (
          <article key={item.title}>
            <item.icon size={31} strokeWidth={1.5} />
            <div>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="landing-split-section" id="about">
        <div>
          <span className="landing-kicker">О курсе</span>
          <h2 data-section-heading>Практика. Обратная связь. Реальный результат.</h2>
          <p>
            Курс построен на практиках: каждую неделю вы будете выступать, получать обратную связь и улучшать навыки.
            Формат сочетает живые вебинары, разборы и домашние задания.
          </p>
          <ul className="landing-check-list">
            {["Индивидуальные занятия", "Разбор выступлений и обратная связь", "Поддержка куратора и сообщества"].map(
              (item) => (
                <li key={item}>
                  <CheckCircle2 size={17} strokeWidth={1.8} />
                  {item}
                </li>
              )
            )}
          </ul>
        </div>
        <div className="landing-program" id="program">
          <span className="landing-kicker">Программа курса</span>
          <h2 data-section-heading>
            {programSections.length > 0
              ? `${programSections.length} ${formatSectionCount(programSections.length)} в программе – от базы до мастерства`
              : "Программа курса"}
          </h2>
          <div>
            {programSections.length > 0 ? (
              programSections.map((section, index) => (
                <button key={section.id} type="button">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </button>
              ))
            ) : (
              <p className="landing-program-empty">Программа скоро появится.</p>
            )}
          </div>
        </div>
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
  { title: "4 недели практики", icon: ShieldCheck },
  { title: "Подходит для новичков и профи", icon: Flame },
  { title: "Живые занятия и обратная связь", icon: Users }
];

const benefits = [
  {
    title: "Уверенность в каждом выступлении",
    text: "Избавитесь от страха сцены и научитесь чувствовать себя свободно в любой ситуации.",
    icon: Mic2
  },
  {
    title: "Влияние на аудиторию",
    text: "Научитесь убеждать, вдохновлять и удерживать внимание слушателей с первых секунд.",
    icon: Target
  },
  {
    title: "Чистая и сильная речь",
    text: "Поставите голос, улучшите дикцию и научитесь выражать мысли точно и понятно.",
    icon: Volume2
  },
  {
    title: "Профессиональный рост",
    text: "Ораторское мастерство откроет новые возможности в карьере и бизнесе.",
    icon: Sparkles
  }
];

function enrollmentLabel(status: CourseEnrollment["status"], t: (key: TranslationKey) => string): string {
  if (status === "approved") return t("approvedStatus");
  if (status === "pending") return t("pendingStatus");
  if (status === "rejected") return t("rejectedStatus");
  return t("revokedStatus");
}

function formatSectionCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return "раздел";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "раздела";
  return "разделов";
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
