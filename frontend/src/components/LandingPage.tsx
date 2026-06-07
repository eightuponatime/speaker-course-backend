import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { getCourseBySlug, getMyCourseEnrollment, requestCourseEnrollment } from "../api/courseDatasource";
import { apiBaseUrl } from "../api/http";
import type { Course, CourseEnrollment, User } from "../entities/course/course";
import type { Language, TranslationKey } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";

type LandingPageProps = {
  courseSlug: string;
  error: string;
  language: Language;
  t: (key: TranslationKey) => string;
  onLanguageChange: (language: Language) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (input: { email: string; password: string; fullName: string }) => Promise<void>;
  currentUser?: User | null;
  onAdminOpen?: () => void;
  onLogout?: () => void;
  onOpenCourse?: () => void;
};

export function LandingPage({
  courseSlug,
  error,
  language,
  t,
  onLanguageChange,
  onLogin,
  onRegister,
  currentUser,
  onAdminOpen,
  onLogout,
  onOpenCourse
}: LandingPageProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCourseBySlug(courseSlug)
      .then(setCourse)
      .catch(() => undefined);
  }, [courseSlug]);

  useEffect(() => {
    let cancelled = false;

    async function loadEnrollment() {
      if (!currentUser || currentUser.role === "admin" || !course) {
        setEnrollment(null);
        return;
      }

      setAccessLoading(true);
      setAccessError("");

      try {
        const nextEnrollment = await getMyCourseEnrollment(course.id);
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
  }, [course, currentUser]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        await onLogin(email, password);
      } else {
        await onRegister({ email, password, fullName });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestAccess() {
    if (!course) return;

    setAccessSubmitting(true);
    setAccessError("");

    try {
      const nextEnrollment = await requestCourseEnrollment(course.id);
      setEnrollment(nextEnrollment);
    } catch (err) {
      setAccessError(formatError(err));
    } finally {
      setAccessSubmitting(false);
    }
  }

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="landing-brand" aria-label="Logos Voice">
          <strong>LOGOS</strong>
          <span>VOICE</span>
        </div>
        <div className="landing-nav-actions">
          {currentUser ? (
            <>
              <NotificationBell emptyLabel={t("noNotifications")} />
              {onAdminOpen ? (
                <button className="landing-nav-button" type="button" onClick={onAdminOpen}>
                  {t("adminPanel")}
                </button>
              ) : null}
            </>
          ) : null}
          <LanguageSwitcher language={language} onChange={onLanguageChange} />
          {currentUser && onLogout ? (
            <button className="landing-nav-button dark" type="button" onClick={onLogout}>
              {t("logout")}
            </button>
          ) : null}
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <h1>{course?.title || "Logos Voice"}</h1>
        </div>
        {currentUser ? (
          <section className="landing-auth landing-status-card">
            {currentUser.role === "admin" ? (
              <>
                <div className="landing-auth-header">
                  <span>{currentUser.email}</span>
                  <strong>{t("adminPanel")}</strong>
                </div>

                <p>{course?.description || t("accessApprovedText")}</p>

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
          <form className={`landing-auth ${mode === "register" ? "register" : "login"}`} onSubmit={handleSubmit}>
            <div className="landing-auth-header">
              <strong>{mode === "login" ? t("enterCourse") : t("requestAccess")}</strong>
            </div>

            <div className="landing-auth-tabs">
              <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
                {t("signIn")}
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                type="button"
                onClick={() => setMode("register")}
              >
                {t("requestAccess")}
              </button>
            </div>

            <div className="landing-field-stack">
              <label>
                <span>{t("email")}</span>
                <input
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                />
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
              {submitting ? t("wait") : mode === "login" ? t("enterCourse") : t("createAccount")}
            </button>
            <a className="landing-google" href={`${apiBaseUrl}/auth/google/start`}>
              <GoogleIcon />
              {t("continueWithGoogle")}
            </a>
            {error ? <p>{error}</p> : null}
          </form>
        )}
      </section>
    </main>
  );
}

function enrollmentLabel(status: CourseEnrollment["status"], t: (key: TranslationKey) => string): string {
  if (status === "approved") return t("approvedStatus");
  if (status === "pending") return t("pendingStatus");
  if (status === "rejected") return t("rejectedStatus");
  return t("revokedStatus");
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
