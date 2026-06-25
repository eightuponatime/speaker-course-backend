import { useEffect, useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";

import { listCourseEnrollments, listCourseStudentActivity, listStudentLessonHistory } from "../api/courseDatasource";
import type { CourseStudentActivity, LessonProgressHistoryItem } from "../entities/course/course";
import type { TranslationKey } from "../i18n";

type StudentActivityPanelProps = {
  courseId: string;
  totalLessons: number;
  t: (key: TranslationKey) => string;
};

export function StudentActivityPanel({ courseId, totalLessons, t }: StudentActivityPanelProps) {
  const [items, setItems] = useState<CourseStudentActivity[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<CourseStudentActivity | null>(null);
  const [historyItems, setHistoryItems] = useState<LessonProgressHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const historyGroups = useMemo(() => groupHistoryBySection(historyItems), [historyItems]);

  useEffect(() => {
    void loadActivity();
    const interval = window.setInterval(() => {
      void loadActivity(false);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [courseId]);

  const onlineCount = useMemo(() => items.filter((item) => item.is_online).length, [items]);

  async function loadActivity(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const data = await listCourseStudentActivity(courseId);
      setItems(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (err) {
      await loadApprovedStudentsFallback();
      setMessage(`Активность временно недоступна: ${formatError(err)}`);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function loadApprovedStudentsFallback() {
    const enrollments = await listCourseEnrollments(courseId, "approved");
    setItems(
      enrollments.map((enrollment) => ({
        course_id: enrollment.course_id,
        user_id: enrollment.user_id,
        created_at: enrollment.requested_at,
        updated_at: enrollment.reviewed_at || enrollment.requested_at,
        user_email: enrollment.user_email || "",
        user_full_name: enrollment.user_full_name,
        last_login_at: undefined,
        is_online: false,
        is_access_expired: false,
        viewed_lessons: 0,
        total_lessons: totalLessons
      }))
    );
  }

  async function openHistory(student: CourseStudentActivity) {
    setHistoryStudent(student);
    setHistoryItems([]);
    setHistoryMessage("");
    setHistoryLoading(true);

    try {
      const data = await listStudentLessonHistory({ courseId, userId: student.user_id });
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistoryMessage(formatError(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <section className="student-activity-panel">
      <div className="student-activity-header">
        <div>
          <h1>Активность учеников</h1>
          <p>Последний урок, срок доступа и история внимания по каждому уроку.</p>
        </div>
        <div className="student-activity-summary">
          <span>{items.length} с доступом</span>
          <span>{onlineCount} в сети</span>
        </div>
        <button className="secondary-button" type="button" onClick={() => void loadActivity()}>
          <RefreshCw size={16} />
          {t("refresh")}
        </button>
      </div>

      {message ? <p className="panel-message">{message}</p> : null}
      {loading ? <div className="empty-state">{t("loadingCourse")}</div> : null}
      {!loading && !message && items.length === 0 ? (
        <div className="empty-state">Пока нет учеников с открытым доступом.</div>
      ) : null}

      <div className="student-activity-table">
        <div className="student-activity-head">
          <span>Ученик</span>
          <span>Статус</span>
          <span>Последний урок</span>
          <span>Прогресс</span>
          <span>Доступ</span>
          <span>Последний вход</span>
          <span>Активность</span>
          <span />
        </div>
        {items.map((item) => (
          <div className="student-activity-row" key={item.user_id}>
            <div>
              <strong>{item.user_full_name || item.user_email}</strong>
              <span>{item.user_email}</span>
            </div>
            <div>
              <span className={item.is_online ? "activity-status online" : "activity-status"}>
                {item.is_online ? "В сети" : "Не в сети"}
              </span>
            </div>
            <div>
              <strong>{item.current_lesson_title || "Еще не открывал"}</strong>
              <span>{item.current_section_title || "Раздел не определен"}</span>
            </div>
            <div>
              <strong>{item.viewed_lessons} / {item.total_lessons}</strong>
              <span>{formatProgress(item)}</span>
            </div>
            <div>
              <strong>{formatAccessState(item)}</strong>
              <span>{item.access_expires_at ? `до ${formatDate(item.access_expires_at)}` : "отсчет не начался"}</span>
            </div>
            <div>
              <strong>{item.last_login_at ? formatDateTime(item.last_login_at) : "нет входов"}</strong>
            </div>
            <div>
              <strong>{item.last_seen_at ? formatDateTime(item.last_seen_at) : "нет активности"}</strong>
              <span>{item.is_online ? "сейчас в курсе" : "последнее внимание"}</span>
            </div>
            <button className="secondary-button compact" type="button" onClick={() => void openHistory(item)}>
              История
            </button>
          </div>
        ))}
      </div>

      {historyStudent ? (
        <div className="admin-dialog-backdrop" onMouseDown={() => setHistoryStudent(null)}>
          <section className="admin-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>{historyStudent.user_full_name || historyStudent.user_email}</h2>
                <p>{historyStudent.user_email}</p>
              </div>
              <button type="button" aria-label="Закрыть" onClick={() => setHistoryStudent(null)}>
                <X size={18} />
              </button>
            </header>

            {historyLoading ? <div className="empty-state">Загружаем историю...</div> : null}
            {historyMessage ? <p className="panel-message">{historyMessage}</p> : null}

            <div className="lesson-history-table">
              <div className="lesson-history-head">
                <span>Урок</span>
                <span>Первый просмотр</span>
                <span>Последнее внимание</span>
              </div>
              {historyGroups.map((group) => (
                <section className="lesson-history-section" key={group.sectionId}>
                  <h3>{group.sectionPosition}. {group.sectionTitle}</h3>
                  {group.items.map((item) => (
                    <div className="lesson-history-row" key={item.lesson_id}>
                      <strong>{item.lesson_position}. {item.lesson_title}</strong>
                      <span>{item.first_viewed_at ? formatDateTime(item.first_viewed_at) : "не открывал"}</span>
                      <span>{item.last_attention_at ? formatDateTime(item.last_attention_at) : "нет данных"}</span>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function progressPercent(item: CourseStudentActivity): number {
  if (item.total_lessons <= 0) return 0;
  return Math.min(100, Math.round((item.viewed_lessons / item.total_lessons) * 100));
}

function formatProgress(item: CourseStudentActivity): string {
  return `${progressPercent(item)}% курса`;
}

function formatAccessState(item: CourseStudentActivity): string {
  if (item.is_access_expired) return "истек";
  if (!item.access_expires_at) return "не начат";
  const daysLeft = Math.max(0, Math.ceil((new Date(item.access_expires_at).getTime() - Date.now()) / 86_400_000));
  return `${daysLeft} дн.`;
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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function groupHistoryBySection(items: LessonProgressHistoryItem[]) {
  const groups: Array<{
    sectionId: string;
    sectionTitle: string;
    sectionPosition: number;
    items: LessonProgressHistoryItem[];
  }> = [];

  for (const item of items) {
    let group = groups.find((current) => current.sectionId === item.section_id);
    if (!group) {
      group = {
        sectionId: item.section_id,
        sectionTitle: item.section_title,
        sectionPosition: item.section_position,
        items: []
      };
      groups.push(group);
    }
    group.items.push(item);
  }

  return groups;
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
