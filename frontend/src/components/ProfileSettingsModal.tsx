import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, Trash2, X } from "lucide-react";

import { changePassword, deleteMe, updateMe } from "../api/authDatasource";
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
  }, [user]);

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    setProfileSaving(true);
    setProfileStatus("");

    try {
      const updated = await updateMe({ email, fullName });
      onUserChange(updated);
      setProfileStatus("Профиль сохранен");
    } catch (err) {
      setProfileStatus(formatError(err));
    } finally {
      setProfileSaving(false);
    }
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

        <form className="profile-form" onSubmit={handleProfileSubmit}>
          <label>
            <span>Имя</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
          </label>
          <label>
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
            />
          </label>
          <div className="profile-actions-row">
            <button type="submit" disabled={profileSaving}>
              {profileSaving ? "Сохранение..." : "Сохранить"}
            </button>
            {profileStatus ? <p>{profileStatus}</p> : null}
          </div>
        </form>

        <div className="profile-secondary-actions">
          <button type="button" onClick={() => setPasswordDialogOpen(true)}>
            <KeyRound size={17} />
            Изменить пароль
          </button>
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
