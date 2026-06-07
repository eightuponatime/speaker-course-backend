import { useEffect, useState } from "react";

import { listCourseEnrollments, reviewEnrollment } from "../api/courseDatasource";
import type { CourseEnrollment, EnrollmentStatus } from "../entities/course/course";
import type { TranslationKey } from "../i18n";

const statuses: EnrollmentStatus[] = ["pending", "approved", "rejected", "revoked"];
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
  const [status, setStatus] = useState<EnrollmentStatus>("pending");
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [counts, setCounts] = useState<Record<EnrollmentStatus, number>>(emptyCounts);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEnrollments();
    loadCounts();
  }, [courseId, status]);

  async function loadEnrollments() {
    setLoading(true);
    try {
      const data = await listCourseEnrollments(courseId, status);
      setEnrollments(Array.isArray(data) ? data : []);
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
        </div>
        <button className="secondary-button" type="button" onClick={loadEnrollments}>
          {t("refresh")}
        </button>
      </div>

      {message ? <p className="panel-message">{message}</p> : null}
      {loading ? <div className="empty-state">{t("loadingCourse")}</div> : null}
      {!loading && enrollments.length === 0 ? <div className="empty-state">{t("noRequests")}</div> : null}

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

function enrollmentStatusValueLabel(status: EnrollmentStatus, t: (key: TranslationKey) => string): string {
  if (status === "pending") return t("pendingStatus");
  if (status === "approved") return t("approvedStatus");
  if (status === "rejected") return t("rejectedStatus");
  return t("revokedStatus");
}
