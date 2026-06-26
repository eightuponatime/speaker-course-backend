import { CheckCircle2, Eye, Menu, X } from "lucide-react";
import { useState } from "react";

import type { Course } from "../entities/course/course";
import type { Notification } from "../entities/notification/notification";
import type { TranslationKey } from "../i18n";
import { NotificationBell } from "./NotificationBell";

type CourseTopbarProps = {
  course: Course;
  activeTab: "curriculum" | "activity" | "requests" | "privileges";
  hasUnpublishedChanges: boolean;
  pendingRequestsCount: number;
  publishStatus: string;
  isPublishing: boolean;
  onTabChange: (tab: "curriculum" | "activity" | "requests" | "privileges") => void;
  t: (key: TranslationKey) => string;
  onLogout: () => void;
  onLandingOpen: () => void;
  onPreview: () => void;
  onPublish: () => void;
  onProfileOpen: () => void;
  onNotificationOpen?: (notification: Notification) => void;
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
  onPublish,
  onProfileOpen,
  onNotificationOpen
}: CourseTopbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const statusText = activeTab === "curriculum" ? publishStatus || t("saved") : t("saved");

  function selectTab(tab: CourseTopbarProps["activeTab"]) {
    onTabChange(tab);
    setMobileMenuOpen(false);
  }

  function runMobileAction(action: () => void) {
    action();
    setMobileMenuOpen(false);
  }

  return (
    <header className="course-topbar">
      <div className="course-topbar-title-row">
        <button
          className="admin-menu-trigger"
          type="button"
          aria-label="Открыть меню админки"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={20} />
        </button>
        <div className="course-title-button">
          <span>{course.title}</span>
        </div>
        <span className="course-status-pill">{courseStatusLabel(course.status, t)}</span>
        {course.status === "published" && hasUnpublishedChanges ? (
          <span className="course-changes-pill">{t("unpublishedChanges")}</span>
        ) : null}
        <div className="mobile-notification-slot">
          <NotificationBell emptyLabel={t("noNotifications")} onNotificationOpen={onNotificationOpen} />
        </div>
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
          <button
            className={activeTab === "privileges" ? "active" : ""}
            type="button"
            onClick={() => onTabChange("privileges")}
          >
            Права
          </button>
        </nav>

        <div className="course-actions">
          <button className="preview-button" type="button" onClick={onLandingOpen}>
            {t("backToLanding")}
          </button>
          <NotificationBell emptyLabel={t("noNotifications")} onNotificationOpen={onNotificationOpen} />
          <span className="save-indicator">
            <CheckCircle2 size={16} />
            {statusText}
          </span>
          <button className="preview-button" type="button" onClick={onPreview}>
            <Eye size={18} />
            {t("preview")}
          </button>
          <button className="preview-button" type="button" onClick={onProfileOpen}>
            Профиль
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

      {mobileMenuOpen ? (
        <div className="admin-mobile-menu-backdrop" onMouseDown={() => setMobileMenuOpen(false)}>
          <aside className="admin-mobile-menu" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>Админ панель</span>
                <strong>{course.title}</strong>
              </div>
              <button type="button" aria-label="Закрыть меню" onClick={() => setMobileMenuOpen(false)}>
                <X size={20} />
              </button>
            </header>

            <nav aria-label="Разделы админки">
              <button className={activeTab === "curriculum" ? "active" : ""} type="button" onClick={() => selectTab("curriculum")}>
                {t("curriculum")}
              </button>
              <button className={activeTab === "activity" ? "active" : ""} type="button" onClick={() => selectTab("activity")}>
                Активность
              </button>
              <button className={activeTab === "requests" ? "active" : ""} type="button" onClick={() => selectTab("requests")}>
                {t("requests")}
                {pendingRequestsCount > 0 ? <span>{pendingRequestsCount}</span> : null}
              </button>
              <button className={activeTab === "privileges" ? "active" : ""} type="button" onClick={() => selectTab("privileges")}>
                Права
              </button>
            </nav>

            <div className="admin-mobile-menu-actions">
              <button type="button" onClick={() => runMobileAction(onLandingOpen)}>
                {t("backToLanding")}
              </button>
              <button type="button" onClick={() => runMobileAction(onPreview)}>
                {t("preview")}
              </button>
              <button type="button" onClick={() => runMobileAction(onProfileOpen)}>
                Профиль
              </button>
              <button
                type="button"
                disabled={isPublishing || !hasUnpublishedChanges}
                onClick={() => runMobileAction(onPublish)}
              >
                {isPublishing ? t("publishing") : t("publish")}
              </button>
              <button type="button" onClick={() => runMobileAction(onLogout)}>
                {t("logout")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  );
}

function courseStatusLabel(status: Course["status"], t: (key: TranslationKey) => string): string {
  if (status === "published") return t("courseStatusPublished");
  if (status === "archived") return t("courseStatusArchived");
  return t("courseStatusDraft");
}
