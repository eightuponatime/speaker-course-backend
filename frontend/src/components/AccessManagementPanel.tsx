import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

import { extendStudentCourseAccess, listCourseStudentActivity } from "../api/courseDatasource";
import type { CourseStudentActivity } from "../entities/course/course";
import { AdminToast } from "./AdminToast";

type AccessManagementPanelProps = {
  courseId: string;
};

export function AccessManagementPanel({ courseId }: AccessManagementPanelProps) {
  const [students, setStudents] = useState<CourseStudentActivity[]>([]);
  const [extendDates, setExtendDates] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState("");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [confirmStudent, setConfirmStudent] = useState<CourseStudentActivity | null>(null);

  useEffect(() => {
    void loadStudents();
  }, [courseId]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) => {
      return [student.user_full_name, student.user_email].some((value) => value?.toLowerCase().includes(query));
    });
  }, [search, students]);

  const counts = useMemo(() => {
    return students.reduce(
      (acc, student) => {
        const state = accessState(student);
        acc.total += 1;
        acc[state] += 1;
        return acc;
      },
      { total: 0, active: 0, soon: 0, expired: 0, idle: 0 }
    );
  }, [students]);

  async function loadStudents() {
    setLoading(true);
    setMessage("");
    try {
      const data = await listCourseStudentActivity(courseId);
      const nextStudents = Array.isArray(data) ? data : [];
      setStudents(nextStudents);
      setExtendDates({});
    } catch (err) {
      setMessage(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleExtendAccess(student: CourseStudentActivity) {
    const date = extendDates[student.user_id];
    if (!date) {
      setMessage("Выберите дату продления.");
      return;
    }

    setSavingUserId(student.user_id);
    setMessage("");
    try {
      await extendStudentCourseAccess({
        courseId,
        userId: student.user_id,
        accessExpiresAt: localDateToEndOfDayISOString(date)
      });
      await loadStudents();
      showToast("Доступ продлен.");
      setConfirmStudent(null);
    } catch (err) {
      setMessage(formatError(err));
    } finally {
      setSavingUserId("");
    }
  }

  function requestExtendAccess(student: CourseStudentActivity) {
    if (!extendDates[student.user_id]) return;
    setConfirmStudent(student);
  }

  function showToast(nextMessage: string) {
    setToast(nextMessage);
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <section className="access-management-panel">
      <div className="access-management-header">
        <div>
          <h1>Управление доступом</h1>
          <p>Сроки доступа учеников и быстрое продление курса.</p>
        </div>
        <label className="student-activity-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по ученику или email" />
        </label>
        <div className="access-management-summary">
          <span>{counts.active} активен</span>
          <span>{counts.soon} скоро</span>
          <span>{counts.expired} истек</span>
        </div>
        <button className="secondary-button" type="button" onClick={() => void loadStudents()} disabled={loading}>
          <RefreshCw size={16} />
          Обновить
        </button>
      </div>

      {message ? <p className="panel-message">{message}</p> : null}
      {loading ? <div className="empty-state">Загрузка доступа...</div> : null}
      {!loading && students.length === 0 ? <div className="empty-state">Пока нет учеников с открытым доступом.</div> : null}

      {!loading && students.length > 0 ? (
        <div className="access-table-wrap">
          <table className="access-table">
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Email</th>
                <th>Статус</th>
                <th>Начало</th>
                <th>Доступ до</th>
                <th>Осталось</th>
                <th>Продлить до</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.user_id}>
                  <td className="access-name-cell">{student.user_full_name || "Без имени"}</td>
                  <td className="access-email-cell">{student.user_email}</td>
                  <td>
                    <span className={`access-state-chip ${accessState(student)}`}>{accessStateLabel(student)}</span>
                  </td>
                  <td>{student.first_access_at ? formatDate(student.first_access_at) : "-"}</td>
                  <td>{student.access_expires_at ? formatDate(student.access_expires_at) : "-"}</td>
                  <td>{accessDaysLabel(student)}</td>
                  <td>
                    <input
                      className="access-date-input"
                      type="date"
                      value={extendDates[student.user_id] || ""}
                      onChange={(event) => setExtendDates((current) => ({ ...current, [student.user_id]: event.target.value }))}
                    />
                  </td>
                  <td>
                    <button
                      className="access-extend-button"
                      type="button"
                      disabled={savingUserId === student.user_id || !extendDates[student.user_id]}
                      onClick={() => requestExtendAccess(student)}
                    >
                      {savingUserId === student.user_id ? "..." : "Продлить"}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8}>По этому поиску учеников не найдено.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {confirmStudent ? (
        <div className="admin-dialog-backdrop" onMouseDown={() => setConfirmStudent(null)}>
          <section className="admin-confirm-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>Продлить доступ?</h2>
                <p>
                  {confirmStudent.user_full_name || confirmStudent.user_email}: до{" "}
                  {formatDate(localDateToEndOfDayISOString(extendDates[confirmStudent.user_id]))}
                </p>
              </div>
            </header>
            <div className="admin-confirm-actions">
              <button type="button" onClick={() => setConfirmStudent(null)}>
                Отмена
              </button>
              <button className="primary" type="button" onClick={() => void handleExtendAccess(confirmStudent)}>
                Подтвердить
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <AdminToast message={toast} />
    </section>
  );
}

type AccessState = "active" | "soon" | "expired" | "idle";

function accessState(student: CourseStudentActivity): AccessState {
  if (student.is_access_expired) return "expired";
  if (!student.access_expires_at) return "idle";
  const daysLeft = Math.ceil((new Date(student.access_expires_at).getTime() - Date.now()) / 86_400_000);
  if (daysLeft <= 7) return "soon";
  return "active";
}

function accessStateLabel(student: CourseStudentActivity): string {
  const state = accessState(student);
  if (state === "expired") return "Срок истек";
  if (state === "soon") return "Скоро закончится";
  if (state === "idle") return "Не начат";
  return "Активен";
}

function accessDaysLabel(student: CourseStudentActivity): string {
  if (!student.access_expires_at) return "-";
  const daysLeft = Math.ceil((new Date(student.access_expires_at).getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return `${Math.abs(daysLeft)} дн. назад`;
  if (daysLeft === 0) return "сегодня";
  return `${daysLeft} дн.`;
}

function localDateToEndOfDayISOString(value: string): string {
  return new Date(`${value}T23:59:59`).toISOString();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
