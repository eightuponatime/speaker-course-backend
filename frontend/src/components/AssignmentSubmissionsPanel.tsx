import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, FileText, MessageSquare, Paperclip, RefreshCw, Send, Upload, Video, X } from "lucide-react";

import {
  addAdminSubmissionComment,
  countAdminUnreadSubmissions,
  getAdminLessonSubmission,
  listAdminLessonSubmissions,
  updateLessonSubmissionStatus
} from "../api/courseDatasource";
import { uploadUserSubmissionAsset } from "../api/mediaDatasource";
import type {
  AdminLessonSubmissionListItem,
  LessonSubmissionDetail,
  SubmissionAttachment,
  SubmissionStatus
} from "../entities/course/course";

type AssignmentSubmissionsPanelProps = {
  courseId: string;
  onUnreadCountChange: (count: number) => void;
};

export function AssignmentSubmissionsPanel({ courseId, onUnreadCountChange }: AssignmentSubmissionsPanelProps) {
  const [items, setItems] = useState<AdminLessonSubmissionListItem[]>([]);
  const [selected, setSelected] = useState<LessonSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentAttachments, setCommentAttachments] = useState<SubmissionAttachment[]>([]);
  const [sortMode, setSortMode] = useState<"unread" | "newest" | "oldest">("unread");
  const [draftStatus, setDraftStatus] = useState<SubmissionStatus>("pending");
  const [confirmStatus, setConfirmStatus] = useState<SubmissionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const unreadCount = useMemo(() => items.filter((item) => item.is_unread_for_admin).length, [items]);

  useEffect(() => {
    void loadItems();
  }, [courseId]);

  useEffect(() => {
    onUnreadCountChange(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  async function loadItems() {
    setLoading(true);
    try {
      const [nextItems, count] = await Promise.all([
        listAdminLessonSubmissions(courseId),
        countAdminUnreadSubmissions(courseId)
      ]);
      setItems(sortItems(nextItems, sortMode));
      onUnreadCountChange(count.count);
    } finally {
      setLoading(false);
    }
  }

  async function openSubmission(item: AdminLessonSubmissionListItem) {
    const detail = await getAdminLessonSubmission(item.id);
    setSelected(detail);
    setDraftStatus(detail.submission.status);
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_unread_for_admin: false } : entry));
  }

  async function changeStatus(status: SubmissionStatus) {
    if (!selected) return;
    setBusy(true);
    try {
      const submission = await updateLessonSubmissionStatus({ submissionId: selected.submission.id, status });
      setSelected({ ...selected, submission });
      setDraftStatus(submission.status);
      await loadItems();
    } finally {
      setBusy(false);
    }
  }

  async function uploadAttachment() {
    const file = await pickPanelFile();
    if (!file || !selected) return;
    const asset = await uploadUserSubmissionAsset({
      file,
      kind: file.type.startsWith("image/") ? "image" : "file",
      courseId,
      lessonId: selected.submission.lesson_id
    });
    setCommentAttachments((current) => [...current, {
      kind: asset.kind,
      name: asset.original_name,
      url: asset.public_url,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes
    }]);
  }

  async function sendComment() {
    if (!selected) return;
    setBusy(true);
    try {
      const comment = await addAdminSubmissionComment({
        submissionId: selected.submission.id,
        body: commentBody,
        attachments: commentAttachments
      });
      setSelected({ ...selected, comments: [...selected.comments, comment] });
      setCommentBody("");
      setCommentAttachments([]);
      await loadItems();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="assignments-panel">
      <header className="assignments-toolbar">
        <div>
          <span>Задания</span>
          <h2>Работы учеников</h2>
        </div>
        <div className="assignments-toolbar-actions">
          <label>
            <span>Порядок</span>
            <select
              value={sortMode}
              onChange={(event) => {
                const nextSort = event.target.value as typeof sortMode;
                setSortMode(nextSort);
                setItems((current) => sortItems(current, nextSort));
              }}
            >
              <option value="unread">Новые и непросмотренные</option>
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
            </select>
          </label>
          <button type="button" onClick={() => void loadItems()} disabled={loading}>
            <RefreshCw size={16} />
            Обновить
          </button>
        </div>
      </header>

      <div className="assignments-table-wrap">
        <table className="assignments-table">
          <thead>
            <tr>
              <th>Статус</th>
              <th>Ученик</th>
              <th>Урок</th>
              <th>Комментарий</th>
              <th>Файлы</th>
              <th>Обновлено</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className={item.is_unread_for_admin ? "unread" : ""} key={item.id}>
                <td><span className={`assignment-status ${item.status}`}>{statusLabel(item.status)}</span></td>
                <td><strong>{item.user_full_name || item.user_email}</strong><small>{item.user_email}</small></td>
                <td><strong>{item.lesson_title}</strong><small>{item.section_title}</small></td>
                <td>{item.body_preview || "Файл без текста"}</td>
                <td>{item.attachment_count > 0 ? <span className="file-count"><Paperclip size={14} />{item.attachment_count}</span> : "0"}</td>
                <td>{formatDateTime(item.updated_at)}</td>
                <td><button type="button" onClick={() => void openSubmission(item)}>Открыть</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 ? <div className="empty-state">Заданий пока нет.</div> : null}
      </div>

      {selected ? (
        <div className="assignment-detail-backdrop" onMouseDown={() => setSelected(null)}>
          <section className="assignment-detail" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>{statusLabel(selected.submission.status)}</span>
                <h3>Submission ученика</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)}><X size={18} /></button>
            </header>
            <p>{selected.submission.body || "Текст не добавлен."}</p>
            <AttachmentList attachments={selected.submission.attachments} />

            <div className="assignment-status-control">
              <label>
                <span>Новый статус</span>
                <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as SubmissionStatus)}>
                  <option value="pending">На рассмотрении</option>
                  <option value="needs_revision">На доработку</option>
                  <option value="accepted">Принято</option>
                </select>
                <ChevronDown size={16} />
              </label>
              <button
                type="button"
                disabled={busy || draftStatus === selected.submission.status}
                onClick={() => setConfirmStatus(draftStatus)}
              >
                Отправить статус
              </button>
            </div>

            <section className="assignment-admin-comments">
              <h4><MessageSquare size={16} />Комментарии</h4>
              {selected.comments.map((comment) => (
                <article className={comment.author_role === "member" ? "student" : "teacher"} key={comment.id}>
                  <strong>{comment.author_full_name || comment.author_email}</strong>
                  {comment.body ? <p>{comment.body}</p> : null}
                  <AttachmentList attachments={comment.attachments} />
                </article>
              ))}
              <textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Ответ ученику" />
              <AttachmentList attachments={commentAttachments} />
              <div className="assignment-actions">
                <button type="button" onClick={() => void uploadAttachment()} disabled={busy}><Upload size={16} />Файл</button>
                <button className="dark" type="button" onClick={() => void sendComment()} disabled={busy || (!commentBody.trim() && commentAttachments.length === 0)}><Send size={16} />Отправить</button>
              </div>
            </section>
          </section>
        </div>
      ) : null}

      {confirmStatus ? (
        <div className="admin-dialog-backdrop" onMouseDown={() => setConfirmStatus(null)}>
          <section className="admin-confirm-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <AlertTriangle size={20} />
              <div>
                <h2>Присвоить статус?</h2>
                <p>Submission получит статус «{statusLabel(confirmStatus)}».</p>
              </div>
            </header>
            <div className="admin-confirm-actions">
              <button type="button" onClick={() => setConfirmStatus(null)}>Отмена</button>
              <button className="danger" type="button" onClick={() => {
                const nextStatus = confirmStatus;
                setConfirmStatus(null);
                void changeStatus(nextStatus);
              }}>
                Подтвердить
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function AttachmentList({ attachments }: { attachments: SubmissionAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="admin-assignment-attachments">
      {attachments.map((attachment, index) => (
        <a className={`attachment-preview ${attachmentPreviewKind(attachment)}`} href={attachment.url} target="_blank" rel="noreferrer" key={`${attachment.url}-${index}`}>
          {attachmentPreviewKind(attachment) === "image" ? <img src={attachment.url} alt="" /> : null}
          {attachmentPreviewKind(attachment) === "video" ? (
            <span className="attachment-preview-icon"><Video size={18} /></span>
          ) : null}
          {attachmentPreviewKind(attachment) === "document" ? (
            <span className="attachment-preview-icon"><FileText size={18} /></span>
          ) : null}
          <span>{attachment.name}</span>
        </a>
      ))}
    </div>
  );
}

function statusLabel(status: SubmissionStatus): string {
  if (status === "accepted") return "Принято";
  if (status === "needs_revision") return "На доработку";
  return "На рассмотрении";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function sortItems(items: AdminLessonSubmissionListItem[], sortMode: "unread" | "newest" | "oldest") {
  return [...items].sort((a, b) => {
    if (sortMode === "unread" && a.is_unread_for_admin !== b.is_unread_for_admin) {
      return a.is_unread_for_admin ? -1 : 1;
    }
    const diff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    return sortMode === "oldest" ? -diff : diff;
  });
}

function attachmentPreviewKind(attachment: SubmissionAttachment): "image" | "video" | "document" {
  if (attachment.kind === "image" || attachment.mime_type?.startsWith("image/")) return "image";
  if (attachment.kind === "video" || attachment.mime_type?.startsWith("video/")) return "video";
  return "document";
}

function pickPanelFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,audio/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.epub,.fb2,*/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
