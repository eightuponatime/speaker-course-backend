import { useEffect, useState } from "react";

import {
  getAuthenticatedCourseCurriculum,
  getCourseBySlug,
  getMyCourseEnrollment,
  requestCourseEnrollment
} from "../api/courseDatasource";
import type { Course, CourseCurriculum, CourseEnrollment, User } from "../entities/course/course";
import type { Language, TranslationKey } from "../i18n";
import { CoursePreviewPage } from "./CoursePreviewPage";
import { LanguageSwitcher } from "./LanguageSwitcher";

type CourseAccessPageProps = {
  courseSlug: string;
  currentUser: User;
  language: Language;
  t: (key: TranslationKey) => string;
  onLanguageChange: (language: Language) => void;
  onLogout: () => void;
  onLandingOpen: () => void;
};

export function CourseAccessPage({
  courseSlug,
  currentUser,
  language,
  t,
  onLanguageChange,
  onLogout,
  onLandingOpen
}: CourseAccessPageProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [curriculum, setCurriculum] = useState<CourseCurriculum | null>(null);
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAccessState() {
      setLoading(true);
      setError("");

      try {
        const nextCourse = await getCourseBySlug(courseSlug);
        if (cancelled) return;

        setCourse(nextCourse);

        const nextEnrollment = await getMyCourseEnrollment(nextCourse.id);
        if (cancelled) return;

        setEnrollment(nextEnrollment);

        if (nextEnrollment?.status === "approved") {
          const nextCurriculum = await getAuthenticatedCourseCurriculum(nextCourse.id);
          if (cancelled) return;
          setCurriculum(nextCurriculum);
        } else {
          setCurriculum(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAccessState();

    return () => {
      cancelled = true;
    };
  }, [courseSlug]);

  async function handleRequestAccess() {
    if (!course) return;

    setSubmitting(true);
    setError("");

    try {
      const nextEnrollment = await requestCourseEnrollment(course.id);
      setEnrollment(nextEnrollment);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="course-access-page">
        <AccessHeader
          language={language}
          t={t}
          onLanguageChange={onLanguageChange}
          onLogout={onLogout}
          onLandingOpen={onLandingOpen}
        />
        <section className="course-access-card">
          <span>{t("loadingCourse")}</span>
        </section>
      </main>
    );
  }

  if (curriculum && enrollment?.status === "approved") {
    return (
      <CoursePreviewPage
        curriculum={curriculum}
        initialLessonId=""
        language={language}
        t={t}
        onLanguageChange={onLanguageChange}
        onLogout={onLogout}
        onLandingOpen={onLandingOpen}
        onBack={onLandingOpen}
        backLabel={t("backToLanding")}
        enableQuizResponses
      />
    );
  }

  const status = enrollment?.status;
  const title =
    status === "pending"
      ? t("accessPendingTitle")
      : status === "rejected"
        ? t("accessRejectedTitle")
        : status === "revoked"
          ? t("accessRevokedTitle")
          : t("accessRequestTitle");
  const text =
    status === "pending"
      ? t("accessPendingText")
      : status === "rejected"
        ? t("accessRejectedText")
        : status === "revoked"
          ? t("accessRevokedText")
          : t("accessRequestText");

  return (
    <main className="course-access-page">
      <AccessHeader
        language={language}
        t={t}
        onLanguageChange={onLanguageChange}
        onLogout={onLogout}
        onLandingOpen={onLandingOpen}
      />
      <section className="course-access-card">
        <div>
          <span>{course?.title || "Logos Voice"}</span>
          <h1>{title}</h1>
          <p>{text}</p>
          <small>{currentUser.email}</small>
        </div>

        {!status ? (
          <button type="button" onClick={handleRequestAccess} disabled={submitting}>
            {submitting ? t("wait") : t("requestAccess")}
          </button>
        ) : null}

        {error ? <p className="course-access-error">{error}</p> : null}
      </section>
    </main>
  );
}

function AccessHeader({
  language,
  t,
  onLanguageChange,
  onLogout,
  onLandingOpen
}: {
  language: Language;
  t: (key: TranslationKey) => string;
  onLanguageChange: (language: Language) => void;
  onLogout: () => void;
  onLandingOpen: () => void;
}) {
  return (
    <header className="course-access-nav">
      <button type="button" onClick={onLandingOpen}>
        {t("backToLanding")}
      </button>
      <LanguageSwitcher language={language} onChange={onLanguageChange} />
      <button type="button" onClick={onLogout}>
        {t("logout")}
      </button>
    </header>
  );
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}
