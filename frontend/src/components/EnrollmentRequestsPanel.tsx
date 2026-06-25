import { useEffect, useState } from "react";

import {
  extendStudentCourseAccess,
  listCourseEnrollments,
  listCourseStudentActivity,
  reviewEnrollment
} from "../api/courseDatasource";
import type { CourseEnrollment, CourseStudentActivity, EnrollmentStatus } from "../entities/course/course";
import type { TranslationKey } from "../i18n";

const statuses: EnrollmentStatus[] = ["pending", "approved", "rejected", "revoked"];
type RequestTab = EnrollmentStatus | "expired";
const emptyCounts: Record<EnrollmentStatus, number> = {
  pending: 0,
  approved: 0,
  rejected: 0,
  revoked: 0
};

type EnrollmentRequestsPanelProps = {
  courseId: string;
  onPendingCountChange: (count: number) => void;
  t: (key: TranslationKey) => string;
};

export function EnrollmentRequestsPanel({ courseId, onPendingCountChange, t }: EnrollmentRequestsPanelProps) {
  const [status, setStatus] = useState<RequestTab>("pending");
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [expiredStudents, setExpiredStudents] = useState<CourseStudentActivity[]>([]);
  const [counts, setCounts] = useState<Record<EnrollmentStatus, number>>(emptyCounts);
  const [expiredCount, setExpiredCount] = useState(0);
  const [extendDates, setExtendDates] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEnrollments();
    loadCounts();
  }, [courseId, status]);

  async function loadEnrollments() {
    setLoading(true);
    try {
      if (status === "expired") {
        const data = await listCourseStudentActivity(courseId);
        const expired = data.filter((item) => item.is_access_expired);
        setExpiredStudents(expired);
        setEnrollments([]);
        setExtendDates(
          Object.fromEntries(
            expired.map((item) => [item.user_id, defaultExtendDate(item.access_expires_at)])
          )
        );
      } else {
        const data = await listCourseEnrollments(courseId, status);
        setEnrollments(Array.isArray(data) ? data : []);
        setExpiredStudents([]);
      }
      setMessage("");
    } catch (err) {
      setMessage(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    try {
      const entries = await Promise.all(
        statuses.map(async (item) => {
          const data = await listCourseEnrollments(courseId, item);
          return [item, Array.isArray(data) ? data.length : 0] as const;
        })
      );
      const nextCounts = Object.fromEntries(entries) as Record<EnrollmentStatus, number>;
      setCounts(nextCounts);
      onPendingCountChange(nextCounts.pending);
      const activity = await listCourseStudentActivity(courseId);
      setExpiredCount(activity.filter((item) => item.is_access_expired).length);
    } catch (err) {
      setMessage(formatError(err));
    }
  }

  async function handleReview(enrollmentId: string, nextStatus: Exclude<EnrollmentStatus, "pending">) {
    try {
      await reviewEnrollment({ enrollmentId, status: nextStatus });
      await loadEnrollments();
      await loadCounts();
      setMessage(t("saved"));
    } catch (err) {
      setMessage(formatError(err));
    }
  }

  async function handleExtendAccess(student: CourseStudentActivity) {
    const date = extendDates[student.user_id];
    if (!date) {
      setMessage("Выберите дату продления");
      return;
    }

    try {
      await extendStudentCourseAccess({
        courseId,
        userId: student.user_id,
        accessExpiresAt: localDateToEndOfDayISOString(date)
      });
      await loadEnrollments();
      await loadCounts();
      setMessage("Доступ продлен");
    } catch (err) {
      setMessage(formatError(err));
    }
  }

  return (
    <section className="requests-panel">
      <div className="requests-toolbar">
        <div className="status-segments" role="tablist" aria-label="Enrollment status">
          {statuses.map((item) => (
            <button
              key={item}
              className={item === status ? "active" : ""}
              type="button"
              onClick={() => setStatus(item)}
            >
              {enrollmentStatusTabLabel(item, t)}
              <span className={item === "pending" && counts[item] > 0 ? "segment-count active" : "segment-count"}>
                {counts[item]}
              </span>
            </button>
          ))}
          <button
            className={status === "expired" ? "active" : ""}
            type="button"
            onClick={() => setStatus("expired")}
          >
            Истек срок
            <span className={expiredCount > 0 ? "segment-count active" : "segment-count"}>{expiredCount}</span>
          </button>
        </div>
        <button className="secondary-button" type="button" onClick={loadEnrollments}>
          {t("refresh")}
        </button>
      </div>

      {message ? <p className="panel-message">{message}</p> : null}
      {loading ? <div className="empty-state">{t("loadingCourse")}</div> : null}
      {!loading && status !== "expired" && enrollments.length === 0 ? <div className="empty-state">{t("noRequests")}</div> : null}
      {!loading && status === "expired" && expiredStudents.length === 0 ? (
        <div className="empty-state">Нет учеников с истекшим сроком доступа.</div>
      ) : null}

      {status !== "expired" ? (
        <div className="enrollment-list">
        {enrollments.map((enrollment) => (
          <article className="enrollment-row" key={enrollment.id}>
            <div>
              <strong>{enrollment.user_full_name || enrollment.user_email}</strong>
              <span>{enrollment.user_email}</span>
            </div>
            <div className="enrollment-meta">
              <span>{new Date(enrollment.requested_at).toLocaleString()}</span>
              <span className="enrollment-status">{enrollmentStatusValueLabel(enrollment.status, t)}</span>
            </div>
            <div className="enrollment-actions">
              {enrollment.status === "pending" ? (
                <button type="button" onClick={() => handleReview(enrollment.id, "approved")}>
                  {t("approve")}
                </button>
              ) : null}
              {enrollment.status === "pending" ? (
                <button type="button" onClick={() => handleReview(enrollment.id, "rejected")}>
                  {t("reject")}
                </button>
              ) : null}
              {enrollment.status === "approved" ? (
                <button type="button" onClick={() => handleReview(enrollment.id, "revoked")}>
                  {t("revoke")}
                </button>
              ) : null}
              {enrollment.status === "rejected" || enrollment.status === "revoked" ? (
                <button type="button" onClick={() => handleReview(enrollment.id, "approved")}>
                  {t("restore")}
                </button>
              ) : null}
            </div>
          </article>
        ))}
        </div>
      ) : (
        <div className="enrollment-list">
          {expiredStudents.map((student) => (
            <article className="enrollment-row expired-access-row" key={student.user_id}>
              <div>
                <strong>{student.user_full_name || student.user_email}</strong>
                <span>{student.user_email}</span>
              </div>
              <div className="enrollment-meta">
                <span>{student.access_expires_at ? `Истек: ${formatDateTime(student.access_expires_at)}` : "Срок не задан"}</span>
                <span className="enrollment-status">{student.viewed_lessons} / {student.total_lessons} уроков</span>
              </div>
              <div className="enrollment-actions extend-actions">
                <label>
                  Продлить до
                  <input
                    type="date"
                    value={extendDates[student.user_id] || ""}
                    onChange={(event) =>
                      setExtendDates((current) => ({ ...current, [student.user_id]: event.target.value }))
                    }
                  />
                </label>
                <button type="button" onClick={() => void handleExtendAccess(student)}>
                  Продлить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function enrollmentStatusTabLabel(status: EnrollmentStatus, t: (key: TranslationKey) => string): string {
  if (status === "pending") return t("pending");
  if (status === "approved") return t("approved");
  if (status === "rejected") return t("rejected");
  return t("revoked");
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function defaultExtendDate(value?: string): string {
  const base = value && new Date(value).getTime() > Date.now() ? new Date(value) : new Date();
  base.setMonth(base.getMonth() + 1);
  return toLocalDateInputValue(base);
}

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateToEndOfDayISOString(value: string): string {
  const date = new Date(`${value}T23:59:59`);
  return date.toISOString();
}

function enrollmentStatusValueLabel(status: EnrollmentStatus, t: (key: TranslationKey) => string): string {
  if (status === "pending") return t("pendingStatus");
  if (status === "approved") return t("approvedStatus");
  if (status === "rejected") return t("rejectedStatus");
  return t("revokedStatus");
}
