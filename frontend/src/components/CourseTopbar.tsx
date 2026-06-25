import { CheckCircle2, Eye } from "lucide-react";

import type { Course } from "../entities/course/course";
import type { TranslationKey } from "../i18n";
import { NotificationBell } from "./NotificationBell";

type CourseTopbarProps = {
  course: Course;
  activeTab: "curriculum" | "activity" | "requests";
  hasUnpublishedChanges: boolean;
  pendingRequestsCount: number;
  publishStatus: string;
  isPublishing: boolean;
  onTabChange: (tab: "curriculum" | "activity" | "requests") => void;
  t: (key: TranslationKey) => string;
  onLogout: () => void;
  onLandingOpen: () => void;
  onPreview: () => void;
  onPublish: () => void;
};

export function CourseTopbar({
  course,
  activeTab,
  hasUnpublishedChanges,
  pendingRequestsCount,
  publishStatus,
  isPublishing,
  onTabChange,
  t,
  onLogout,
  onLandingOpen,
  onPreview,
  onPublish
}: CourseTopbarProps) {
  const statusText = activeTab === "curriculum" ? publishStatus || t("saved") : t("saved");

  return (
    <header className="course-topbar">
      <div className="course-topbar-title-row">
        <div className="course-title-button">
          <span>{course.title}</span>
        </div>
        <span className="course-status-pill">{courseStatusLabel(course.status, t)}</span>
        {course.status === "published" && hasUnpublishedChanges ? (
          <span className="course-changes-pill">{t("unpublishedChanges")}</span>
        ) : null}
      </div>

      <div className="course-topbar-bottom-row">
        <nav className="course-tabs" aria-label="Course admin sections">
          <button
            className={activeTab === "curriculum" ? "active" : ""}
            type="button"
            onClick={() => onTabChange("curriculum")}
          >
            {t("curriculum")}
          </button>
          <button
            className={activeTab === "activity" ? "active" : ""}
            type="button"
            onClick={() => onTabChange("activity")}
          >
            Активность
          </button>
          <button
            className={activeTab === "requests" ? "active" : ""}
            type="button"
            onClick={() => onTabChange("requests")}
          >
            {t("requests")}
            <span className={pendingRequestsCount > 0 ? "tab-count active" : "tab-count"}>
              {pendingRequestsCount}
            </span>
          </button>
        </nav>

        <div className="course-actions">
          <button className="preview-button" type="button" onClick={onLandingOpen}>
            {t("backToLanding")}
          </button>
          <NotificationBell emptyLabel={t("noNotifications")} />
          <span className="save-indicator">
            <CheckCircle2 size={16} />
            {statusText}
          </span>
          <button className="preview-button" type="button" onClick={onPreview}>
            <Eye size={18} />
            {t("preview")}
          </button>
          <button
            className="publish-button"
            type="button"
            disabled={isPublishing || !hasUnpublishedChanges}
            onClick={onPublish}
          >
            {isPublishing ? t("publishing") : t("publish")}
          </button>
          <button className="preview-button" type="button" onClick={onLogout}>
            {t("logout")}
          </button>
        </div>
      </div>
    </header>
  );
}

function courseStatusLabel(status: Course["status"], t: (key: TranslationKey) => string): string {
  if (status === "published") return t("courseStatusPublished");
  if (status === "archived") return t("courseStatusArchived");
  return t("courseStatusDraft");
}
