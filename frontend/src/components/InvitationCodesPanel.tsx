import { useEffect, useState } from "react";
import { Copy, Plus, RefreshCw, X } from "lucide-react";

import { generateInvitationCode, listInvitationCodes } from "../api/courseDatasource";
import type { CourseInvitationCode, InvitationCodeStatus } from "../entities/course/course";
import { AdminToast } from "./AdminToast";

type InvitationCodesPanelProps = {
  courseId: string;
};

export function InvitationCodesPanel({ courseId }: InvitationCodesPanelProps) {
  const [codes, setCodes] = useState<CourseInvitationCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [generatedCode, setGeneratedCode] = useState<CourseInvitationCode | null>(null);

  useEffect(() => {
    void loadCodes();
  }, [courseId]);

  async function loadCodes() {
    setLoading(true);
    try {
      const data = await listInvitationCodes(courseId);
      setCodes(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (err) {
      const errorMessage = formatError(err);
      if (errorMessage.includes("404")) {
        setCodes([]);
        setMessage("");
        return;
      }
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const code = await generateInvitationCode(courseId);
      setCodes((current) => [code, ...current]);
      setGeneratedCode(code);
      showToast("Код приглашения создан.");
    } catch (err) {
      setMessage(formatError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function copySignupLink(code: string) {
    const link = signupLink(code);
    await navigator.clipboard.writeText(link);
    showToast("Ссылка скопирована.");
  }

  function showToast(nextMessage: string) {
    setToast(nextMessage);
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <section className="invitation-codes-panel">
      <div className="admin-section-heading compact">
        <div>
          <span>Приглашения</span>
          <h1>Коды регистрации</h1>
          <p>Одноразовые ссылки автоматически регистрируют ученика и открывают доступ к курсу.</p>
        </div>
        <div className="invitation-heading-actions">
          <button type="button" onClick={() => void loadCodes()} disabled={loading}>
            <RefreshCw size={16} />
            Обновить
          </button>
          <button type="button" onClick={() => void handleGenerate()} disabled={generating}>
            <Plus size={16} />
            {generating ? "Создание..." : "Сгенерировать"}
          </button>
        </div>
      </div>

      {message ? <p className="panel-message">{message}</p> : null}
      {loading ? <div className="empty-state">Загрузка кодов...</div> : null}
      {!loading && codes.length === 0 ? <div className="empty-state">Коды приглашений пока не создавались.</div> : null}

      {!loading && codes.length > 0 ? (
        <div className="invitation-table-wrap">
          <table className="invitation-table">
            <thead>
              <tr>
                <th>Ссылка</th>
                <th>Код</th>
                <th>Статус</th>
                <th>Создан</th>
                <th>Истекает</th>
                <th>Использован</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((item) => {
                const link = signupLink(item.code);
                return (
                  <tr key={item.id}>
                    <td className="invitation-link-cell" title={link}>{link}</td>
                    <td className="invitation-code-cell">{item.code}</td>
                    <td>
                      <span className={`invitation-status ${item.status}`}>{statusLabel(item.status)}</span>
                    </td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>{formatDateTime(item.expires_at)}</td>
                    <td>{item.used_at ? formatDateTime(item.used_at) : "-"}</td>
                    <td>
                      <button className="invitation-copy-button" type="button" onClick={() => void copySignupLink(item.code)}>
                        <Copy size={15} />
                        Копировать
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {generatedCode ? (
        <div className="admin-dialog-backdrop" onMouseDown={() => setGeneratedCode(null)}>
          <section className="admin-dialog invitation-generated-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>Код приглашения создан</h2>
                <p>Скопируйте персональную ссылку и отправьте ее ученику.</p>
              </div>
              <button type="button" aria-label="Закрыть" onClick={() => setGeneratedCode(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="invitation-generated-body">
              <label>
                <span>Ссылка регистрации</span>
                <input readOnly value={signupLink(generatedCode.code)} onFocus={(event) => event.currentTarget.select()} />
              </label>
              <div className="invitation-generated-meta">
                <span>Код: {generatedCode.code}</span>
                <span>Истекает: {formatDateTime(generatedCode.expires_at)}</span>
              </div>
              <div className="invitation-generated-actions">
                <button type="button" onClick={() => void copySignupLink(generatedCode.code)}>
                  <Copy size={16} />
                  Скопировать ссылку
                </button>
                <button type="button" onClick={() => setGeneratedCode(null)}>
                  Закрыть
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      <AdminToast message={toast} />
    </section>
  );
}

function signupLink(code: string): string {
  return `${window.location.origin}/signup/${encodeURIComponent(code)}`;
}

function statusLabel(status: InvitationCodeStatus): string {
  if (status === "active") return "Активен";
  if (status === "used") return "Использован";
  return "Истек";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
