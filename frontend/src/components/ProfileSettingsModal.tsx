import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Edit3, KeyRound, RefreshCw, Trash2, X } from "lucide-react";

import { changePassword, deleteMe, updateMe } from "../api/authDatasource";
import { apiBaseUrl } from "../api/http";
import type { User } from "../entities/course/course";

type ProfileSettingsModalProps = {
  user: User;
  onClose: () => void;
  onUserChange: (user: User) => void;
  onAccountDeleted: () => void;
};

export function ProfileSettingsModal({
  user,
  onClose,
  onUserChange,
  onAccountDeleted
}: ProfileSettingsModalProps) {
  const [email, setEmail] = useState(user.email);
  const [fullName, setFullName] = useState(user.full_name);
  const [isEditing, setIsEditing] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  useEffect(() => {
    setEmail(user.email);
    setFullName(user.full_name);
    setIsEditing(false);
  }, [user]);

  const canChangeEmail = user.can_change_email !== false;
  const canChangePassword = user.can_change_password === true;
  const isGoogleAccount = user.auth_provider === "google" || user.auth_provider === "google_password";
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedFullName = fullName.trim();
  const hasProfileChanges =
    normalizedFullName !== user.full_name || (canChangeEmail && normalizedEmail !== user.email);
  const canSaveProfile =
    isEditing && hasProfileChanges && normalizedFullName.length > 0 && (!canChangeEmail || normalizedEmail.length > 0);
  const authLabel = user.auth_provider === "google" ? "Google" : "Email и пароль";

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSaveProfile) return;

    setProfileSaving(true);
    setProfileStatus("");

    try {
      const updated = await updateMe({
        email: canChangeEmail ? normalizedEmail : user.email,
        fullName: normalizedFullName
      });
      onUserChange(updated);
      setProfileStatus("Профиль сохранен");
      setIsEditing(false);
    } catch (err) {
      setProfileStatus(formatError(err));
    } finally {
      setProfileSaving(false);
    }
  }

  function cancelEditing() {
    setEmail(user.email);
    setFullName(user.full_name);
    setProfileStatus("");
    setIsEditing(false);
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordStatus("");

    if (newPassword !== repeatPassword) {
      setPasswordStatus("Новый пароль и повтор не совпадают");
      setPasswordSaving(false);
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword, repeatPassword });
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setPasswordStatus("Пароль обновлен");
      window.setTimeout(() => setPasswordDialogOpen(false), 700);
    } catch (err) {
      setPasswordStatus(formatError(err));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteSaving(true);
    setDeleteStatus("");

    try {
      await deleteMe();
      onAccountDeleted();
    } catch (err) {
      setDeleteStatus(formatError(err));
    } finally {
      setDeleteSaving(false);
    }
  }

  return (
    <div className="profile-modal-backdrop" onMouseDown={onClose}>
      <section className="profile-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="profile-modal-header">
          <div>
            <span>Аккаунт</span>
            <h2>Настройки профиля</h2>
          </div>
          <button type="button" aria-label="Закрыть" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        {!isEditing ? (
          <section className="profile-summary">
            <div>
              <span>Имя</span>
              <strong>{user.full_name}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span>Способ входа</span>
              <strong>{authLabel}</strong>
            </div>
            <button type="button" onClick={() => setIsEditing(true)}>
              <Edit3 size={17} />
              Редактировать
            </button>
            {profileStatus ? <p>{profileStatus}</p> : null}
          </section>
        ) : (
          <form className="profile-form" onSubmit={handleProfileSubmit}>
            <label>
              <span>Имя</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
            </label>
            <label>
              <span>Email</span>
              <input
                value={canChangeEmail ? email : user.email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                disabled={!canChangeEmail}
              />
            </label>
            {!canChangeEmail ? (
              <p className="profile-hint">Email обновляется через Google. Если он изменился в Google-аккаунте, обновите его через повторный Google-вход.</p>
            ) : null}
            <div className="profile-actions-row">
              <button type="submit" disabled={profileSaving || !canSaveProfile}>
                {profileSaving ? "Сохранение..." : "Сохранить"}
              </button>
              <button className="secondary" type="button" disabled={profileSaving} onClick={cancelEditing}>
                Отмена
              </button>
              {profileStatus ? <p>{profileStatus}</p> : null}
            </div>
          </form>
        )}

        <div className="profile-secondary-actions">
          {canChangePassword ? (
            <button type="button" onClick={() => setPasswordDialogOpen(true)}>
              <KeyRound size={17} />
              Изменить пароль
            </button>
          ) : null}
          {isGoogleAccount ? (
            <a className="profile-secondary-link" href={`${apiBaseUrl}/auth/google/start`}>
              <RefreshCw size={17} />
              Обновить email через Google
            </a>
          ) : null}
          {!canChangePassword && !isGoogleAccount ? (
            <span className="profile-secondary-note">Пароль для этого аккаунта не задан</span>
          ) : null}
          <button className="danger" type="button" onClick={() => setDeleteConfirmOpen(true)}>
            <Trash2 size={17} />
            Удалить аккаунт
          </button>
        </div>

        {passwordDialogOpen ? (
          <div className="profile-nested-backdrop" onMouseDown={() => setPasswordDialogOpen(false)}>
            <form className="profile-nested-dialog" onSubmit={handlePasswordSubmit} onMouseDown={(event) => event.stopPropagation()}>
              <header>
                <h3>Изменить пароль</h3>
                <button type="button" aria-label="Закрыть" onClick={() => setPasswordDialogOpen(false)}>
                  <X size={18} />
                </button>
              </header>
              <label>
                <span>Старый пароль</span>
                <input
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                />
              </label>
              <label>
                <span>Новый пароль</span>
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                />
              </label>
              <label>
                <span>Повторите новый пароль</span>
                <input
                  value={repeatPassword}
                  onChange={(event) => setRepeatPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                />
              </label>
              <button type="submit" disabled={passwordSaving}>
                {passwordSaving ? "Сохранение..." : "Сменить пароль"}
              </button>
              {passwordStatus ? <p>{passwordStatus}</p> : null}
            </form>
          </div>
        ) : null}

        {deleteConfirmOpen ? (
          <div className="profile-nested-backdrop" onMouseDown={() => setDeleteConfirmOpen(false)}>
            <section className="profile-nested-dialog" onMouseDown={(event) => event.stopPropagation()}>
              <header>
                <h3>Удалить аккаунт?</h3>
                <button type="button" aria-label="Закрыть" onClick={() => setDeleteConfirmOpen(false)}>
                  <X size={18} />
                </button>
              </header>
              <p>
                Аккаунт будет удален вместе с заявками, прогрессом и сессиями. Для администратора удаление через профиль
                запрещено.
              </p>
              <button className="danger" type="button" disabled={deleteSaving} onClick={handleDeleteAccount}>
                {deleteSaving ? "Удаление..." : "Удалить аккаунт"}
              </button>
              {deleteStatus ? <p>{deleteStatus}</p> : null}
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}
