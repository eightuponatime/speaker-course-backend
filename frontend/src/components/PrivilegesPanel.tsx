import { RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { listAdminCourseUsers, updateAdminCourseUserRole } from "../api/courseDatasource";
import type { AdminUserWithEnrollment } from "../entities/course/course";

type PrivilegesPanelProps = {
  courseId: string;
  currentUserId: string;
  currentUserRole: AdminUserWithEnrollment["role"];
};

type RoleFilter = "" | "owner" | "admin" | "member";

export function PrivilegesPanel({ courseId, currentUserId, currentUserRole }: PrivilegesPanelProps) {
  const [users, setUsers] = useState<AdminUserWithEnrollment[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const [roleConfirm, setRoleConfirm] = useState<{
    user: AdminUserWithEnrollment;
    nextRole: AdminUserWithEnrollment["role"];
  } | null>(null);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        user.full_name.toLowerCase().includes(normalizedSearch);
      const matchesRole = role === "" || user.role === role;

      return matchesSearch && matchesRole;
    });
  }, [role, search, users]);

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

  function requestRoleChange(user: AdminUserWithEnrollment, nextRole: AdminUserWithEnrollment["role"]) {
    if (user.role === nextRole) return;
    setRoleConfirm({ user, nextRole });
  }

  async function changeRole(user: AdminUserWithEnrollment, nextRole: AdminUserWithEnrollment["role"]) {
    setSavingUserId(user.id);
    setMessage("");
    try {
      await updateAdminCourseUserRole({ courseId, userId: user.id, role: nextRole });
      await loadUsers();
      setMessage(roleChangeMessage(nextRole));
      setRoleConfirm(null);
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
          <p>Управляйте ролями пользователей и правами администраторов.</p>
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
        {/* Заявки больше не используются: доступ выдается одноразовым кодом приглашения.
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
        */}
      </div>

      <div className="privileges-summary">
        <span>{filteredUsers.length} пользователей</span>
      </div>

      {message ? <div className="admin-inline-message">{message}</div> : null}

      <div className="privileges-table-wrap">
        <table className="privileges-table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Роль</th>
              <th>Вход</th>
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
                  <span className={rolePillClassName(user.role)}>{roleLabel(user.role)}</span>
                </td>
                <td>{authProviderLabel(user.auth_provider)}</td>
                <td>{user.enrollment_requested_at ? formatDate(user.enrollment_requested_at) : formatDate(user.created_at)}</td>
                <td>
                  <div className="privileges-actions">
                    {user.role === "member" ? (
                      <>
                        <button type="button" onClick={() => requestRoleChange(user, "admin")} disabled={savingUserId === user.id}>
                          Сделать админом
                        </button>
                        {currentUserRole === "owner" ? (
                          <button type="button" onClick={() => requestRoleChange(user, "owner")} disabled={savingUserId === user.id}>
                            Сделать главным
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {user.role === "admin" && currentUserRole === "owner" ? (
                      <button
                        type="button"
                        onClick={() => requestRoleChange(user, "member")}
                        disabled={savingUserId === user.id || user.id === currentUserId}
                      >
                        Сделать учеником
                      </button>
                    ) : null}
                    {user.role === "owner" && currentUserRole === "owner" && user.id !== currentUserId ? (
                      <button type="button" onClick={() => requestRoleChange(user, "admin")} disabled={savingUserId === user.id}>
                        Сделать админом
                      </button>
                    ) : null}
                    {user.role !== "member" && currentUserRole !== "owner" ? <span className="privileges-action-note">Только главный админ</span> : null}
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5}>Пользователи не найдены.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {roleConfirm ? (
        <div className="admin-dialog-backdrop" onMouseDown={() => setRoleConfirm(null)}>
          <section className="admin-confirm-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>Изменить права?</h2>
                <p>
                  {roleConfirm.user.full_name || roleConfirm.user.email}: {roleLabel(roleConfirm.user.role)} {"->"} {roleLabel(roleConfirm.nextRole)}
                </p>
              </div>
            </header>
            <div className="admin-confirm-actions">
              <button type="button" onClick={() => setRoleConfirm(null)}>
                Отмена
              </button>
              <button className="primary" type="button" onClick={() => void changeRole(roleConfirm.user, roleConfirm.nextRole)}>
                Подтвердить
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

const roleFilters: Array<{ label: string; value: RoleFilter }> = [
  { label: "Все роли", value: "" },
  { label: "Ученики", value: "member" },
  { label: "Админы", value: "admin" },
  { label: "Главные", value: "owner" }
];

// Заявки больше не используются: доступ выдается одноразовым кодом приглашения.
// const enrollmentFilters: Array<{ label: string; value: EnrollmentFilter }> = [
//   { label: "Все заявки", value: "" },
//   { label: "Ожидают", value: "pending" },
//   { label: "Одобрены", value: "approved" },
//   { label: "Отклонены", value: "rejected" },
//   { label: "Отозваны", value: "revoked" },
//   { label: "Без заявки", value: "none" }
// ];

function roleLabel(role: AdminUserWithEnrollment["role"]): string {
  if (role === "owner") return "Главный админ";
  return role === "admin" ? "Админ" : "Ученик";
}

function rolePillClassName(role: AdminUserWithEnrollment["role"]): string {
  if (role === "owner") return "role-pill owner";
  return role === "admin" ? "role-pill admin" : "role-pill";
}

function roleChangeMessage(role: AdminUserWithEnrollment["role"]): string {
  if (role === "owner") return "Пользователь назначен главным администратором.";
  if (role === "admin") return "Пользователь назначен администратором.";
  return "Пользователь переведен в ученики.";
}

function authProviderLabel(provider: AdminUserWithEnrollment["auth_provider"]): string {
  if (provider === "google") return "Google";
  if (provider === "google_password") return "Google + пароль";
  return "Email";
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
