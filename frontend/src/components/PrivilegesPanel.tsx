import { RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { listAdminCourseUsers, updateAdminCourseUserRole } from "../api/courseDatasource";
import type { AdminUserWithEnrollment, EnrollmentStatus } from "../entities/course/course";

type PrivilegesPanelProps = {
  courseId: string;
  currentUserId: string;
};

type RoleFilter = "" | "admin" | "member";
type EnrollmentFilter = "" | "none" | EnrollmentStatus;

export function PrivilegesPanel({ courseId, currentUserId }: PrivilegesPanelProps) {
  const [users, setUsers] = useState<AdminUserWithEnrollment[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("");
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentFilter>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [savingUserId, setSavingUserId] = useState("");

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        user.full_name.toLowerCase().includes(normalizedSearch);
      const matchesRole = role === "" || user.role === role;
      const userEnrollmentStatus = user.enrollment_status || "none";
      const matchesEnrollment = enrollmentStatus === "" || userEnrollmentStatus === enrollmentStatus;

      return matchesSearch && matchesRole && matchesEnrollment;
    });
  }, [enrollmentStatus, role, search, users]);

  const pendingCount = useMemo(
    () => filteredUsers.filter((user) => user.enrollment_status === "pending" && user.role !== "admin").length,
    [filteredUsers]
  );

  useEffect(() => {
    void loadUsers();
  }, [courseId]);

  async function loadUsers() {
    setLoading(true);
    setMessage("");
    try {
      const nextUsers = await listAdminCourseUsers({ courseId });
      setUsers(nextUsers);
    } catch (err) {
      setMessage(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(user: AdminUserWithEnrollment, nextRole: "admin" | "member") {
    if (user.role === nextRole) return;

    setSavingUserId(user.id);
    setMessage("");
    try {
      await updateAdminCourseUserRole({ courseId, userId: user.id, role: nextRole });
      await loadUsers();
      setMessage(nextRole === "admin" ? "Пользователь назначен администратором." : "Пользователь переведен в ученики.");
    } catch (err) {
      setMessage(formatError(err));
    } finally {
      setSavingUserId("");
    }
  }

  return (
    <section className="privileges-panel">
      <div className="admin-section-heading compact">
        <div>
          <span>Права доступа</span>
          <h1>Пользователи и роли</h1>
          <p>Администраторы получают доступ к курсу по роли. Заявка на курс для них не хранится.</p>
        </div>
        <button type="button" onClick={() => void loadUsers()} disabled={loading}>
          <RefreshCw size={17} />
          Обновить
        </button>
      </div>

      <div className="privileges-controls">
        <label className="privileges-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по имени или email"
          />
        </label>
        <div className="privileges-chip-row" aria-label="Фильтр по роли">
          {roleFilters.map((item) => (
            <button
              className={role === item.value ? "active" : ""}
              key={item.label}
              type="button"
              onClick={() => setRole(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="privileges-chip-row" aria-label="Фильтр по заявке">
          {enrollmentFilters.map((item) => (
            <button
              className={enrollmentStatus === item.value ? "active" : ""}
              key={item.label}
              type="button"
              onClick={() => setEnrollmentStatus(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="privileges-summary">
        <span>{filteredUsers.length} пользователей</span>
        <span>{pendingCount} ожидают решения</span>
      </div>

      {message ? <div className="admin-inline-message">{message}</div> : null}

      <div className="privileges-table-wrap">
        <table className="privileges-table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Роль</th>
              <th>Вход</th>
              <th>Заявка</th>
              <th>Дата</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className={user.enrollment_status === "pending" ? "pending" : ""}>
                <td>
                  <strong>{user.full_name || "Без имени"}</strong>
                  <span>{user.email}</span>
                </td>
                <td>
                  <span className={user.role === "admin" ? "role-pill admin" : "role-pill"}>{roleLabel(user.role)}</span>
                </td>
                <td>{authProviderLabel(user.auth_provider)}</td>
                <td>{enrollmentLabel(user)}</td>
                <td>{user.enrollment_requested_at ? formatDate(user.enrollment_requested_at) : formatDate(user.created_at)}</td>
                <td>
                  <div className="privileges-actions">
                    {user.role !== "admin" ? (
                      <button
                        type="button"
                        onClick={() => void changeRole(user, "admin")}
                        disabled={savingUserId === user.id}
                      >
                        Сделать админом
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void changeRole(user, "member")}
                        disabled={savingUserId === user.id || user.id === currentUserId}
                      >
                        Сделать учеником
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6}>Пользователи не найдены.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const roleFilters: Array<{ label: string; value: RoleFilter }> = [
  { label: "Все роли", value: "" },
  { label: "Ученики", value: "member" },
  { label: "Админы", value: "admin" }
];

const enrollmentFilters: Array<{ label: string; value: EnrollmentFilter }> = [
  { label: "Все заявки", value: "" },
  { label: "Ожидают", value: "pending" },
  { label: "Одобрены", value: "approved" },
  { label: "Отклонены", value: "rejected" },
  { label: "Отозваны", value: "revoked" },
  { label: "Без заявки", value: "none" }
];

function roleLabel(role: AdminUserWithEnrollment["role"]): string {
  return role === "admin" ? "Админ" : "Ученик";
}

function authProviderLabel(provider: AdminUserWithEnrollment["auth_provider"]): string {
  if (provider === "google") return "Google";
  if (provider === "google_password") return "Google + пароль";
  return "Email";
}

function enrollmentLabel(user: AdminUserWithEnrollment): string {
  if (user.role === "admin") return "Не требуется";
  if (user.enrollment_status === "pending") return "Ожидает";
  if (user.enrollment_status === "approved") return "Доступ открыт";
  if (user.enrollment_status === "rejected") return "Отклонена";
  if (user.enrollment_status === "revoked") return "Отозвана";
  return "Нет заявки";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}
