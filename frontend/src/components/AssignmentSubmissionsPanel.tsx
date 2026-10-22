import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, FileText, History, Image, MessageSquare, Paperclip, RefreshCw, Send, Upload, Video, X } from "lucide-react";

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
  LessonSubmissionRevision,
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
  const [confirmSend, setConfirmSend] = useState<{
    status: SubmissionStatus;
    hasReply: boolean;
    statusChanged: boolean;
  } | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<LessonSubmissionRevision | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);
  const unreadCount = useMemo(() => items.filter((item) => item.is_unread_for_admin).length, [items]);
  const hasAdminReply = commentBody.trim().length > 0 || commentAttachments.length > 0;
  const statusChanged = Boolean(selected && draftStatus !== selected.submission.status);
  const canSendResponse = Boolean(selected && !busy && !uploadingLabel && (hasAdminReply || statusChanged));

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

  async function uploadAttachment(choice: "media" | "document") {
    const file = await pickPanelFile(choice);
    setAttachmentMenuOpen(false);
    if (!file || !selected) return;
    setUploadingLabel(file.name);
    setUploadError("");
    setUploadProgress(0);
    const assetKind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
    try {
      const asset = await uploadUserSubmissionAsset({
        file,
        kind: assetKind,
        courseId,
        lessonId: selected.submission.lesson_id,
        onProgress: setUploadProgress
      });
      setUploadProgress(100);
      setCommentAttachments((current) => [...current, {
        kind: asset.kind,
        name: asset.original_name,
        url: asset.public_url,
        mime_type: asset.mime_type,
        size_bytes: asset.size_bytes
      }]);
    } catch (error) {
      setUploadError(`Не удалось загрузить файл: ${error instanceof Error ? error.message : "проверьте соединение и повторите попытку"}`);
    } finally {
      setUploadingLabel("");
      setUploadProgress(null);
    }
  }

  function requestSendComment() {
    if (!selected || !canSendResponse) return;
    setConfirmSend({ status: draftStatus, hasReply: hasAdminReply, statusChanged });
  }

  async function sendAdminResponse() {
    if (!selected) return;
    setBusy(true);
    try {
      const shouldCreateComment = commentBody.trim().length > 0 || commentAttachments.length > 0;
      const nextSubmission = draftStatus !== selected.submission.status
        ? await updateLessonSubmissionStatus({ submissionId: selected.submission.id, status: draftStatus })
        : selected.submission;
      const nextComment = shouldCreateComment
        ? await addAdminSubmissionComment({
            submissionId: selected.submission.id,
            body: commentBody,
            attachments: commentAttachments
          })
        : null;
      setSelected((current) => current ? {
        ...current,
        submission: nextSubmission,
        comments: nextComment ? [...current.comments, nextComment] : current.comments
      } : current);
      setDraftStatus(nextSubmission.status);
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
            {!loading && items.length === 0 ? (
              <tr className="assignments-empty-row">
                <td colSpan={7}>Заданий пока нет.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="assignment-detail-backdrop" onMouseDown={() => setSelected(null)}>
          <section className="assignment-detail" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className={`assignment-detail-status ${selected.submission.status}`}>{statusLabel(selected.submission.status)}</span>
                <h3>Submission ученика</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)}><X size={18} /></button>
            </header>
            <p>{selected.submission.body || "Текст не добавлен."}</p>
            <AttachmentList attachments={selected.submission.attachments} />
            {selected.revisions.length ? (
              <div className="submission-revisions">
                <strong><History size={15} /> История правок</strong>
                {selected.revisions.map((revision) => (
                  <button type="button" key={revision.id} onClick={() => setSelectedRevision(revision)}>
                    Отредактировано {formatDateTime(revision.created_at)}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="assignment-status-control">
              <label>
                <span>Новый статус</span>
                <select className={`status-select ${draftStatus}`} value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as SubmissionStatus)}>
                  <option className="pending" value="pending">На рассмотрении</option>
                  <option className="needs_revision" value="needs_revision">На доработку</option>
                  <option className="accepted" value="accepted">Принято</option>
                </select>
                <ChevronDown size={16} />
              </label>
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
              <AttachmentList
                attachments={commentAttachments}
                onRemove={(index) => setCommentAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              />
              {uploadingLabel ? <UploadProgress label={uploadingLabel} progress={uploadProgress} /> : null}
              {uploadError ? <p role="alert" className="admin-media-error">{uploadError}</p> : null}
              <div className="assignment-actions">
                <div className="assignment-attach-menu">
                  <button type="button" onClick={() => setAttachmentMenuOpen((open) => !open)} disabled={busy}>
                    <Upload size={16} />
                    Прикрепить
                  </button>
                  {attachmentMenuOpen ? (
                    <div className="assignment-attach-popover">
                      <button type="button" onClick={() => void uploadAttachment("media")}>
                        <Image size={18} />
                        Фото, видео или аудио
                      </button>
                      <button type="button" onClick={() => void uploadAttachment("document")}>
                        <FileText size={18} />
                        Документ
                      </button>
                    </div>
                  ) : null}
                </div>
                <button className="dark" type="button" onClick={requestSendComment} disabled={!canSendResponse}><Send size={16} />Отправить</button>
              </div>
            </section>
          </section>
        </div>
      ) : null}

      {selectedRevision ? (
        <RevisionDiffDialog revision={selectedRevision} onClose={() => setSelectedRevision(null)} />
      ) : null}

      {confirmSend ? (
        <div className="admin-dialog-backdrop" onMouseDown={() => setConfirmSend(null)}>
          <section className="admin-confirm-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <AlertTriangle size={20} />
              <div>
                <h2>{confirmSend.hasReply ? "Отправить комментарий?" : "Обновить статус?"}</h2>
                <p>
                  {confirmSend.hasReply
                    ? confirmSend.statusChanged
                      ? `Уверены, что хотите отправить комментарий ученику и обновить статус задания на «${statusLabel(confirmSend.status)}»?`
                      : "Уверены, что хотите отправить комментарий ученику?"
                    : `Уверены, что хотите обновить статус задания на «${statusLabel(confirmSend.status)}» без комментария ученику?`}
                </p>
              </div>
            </header>
            <div className="admin-confirm-actions">
              <button type="button" onClick={() => setConfirmSend(null)}>Отмена</button>
              <button className="danger" type="button" onClick={() => {
                setConfirmSend(null);
                void sendAdminResponse();
              }}>
                Отправить
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function RevisionDiffDialog({ revision, onClose }: { revision: LessonSubmissionRevision; onClose: () => void }) {
  const previousAttachments = Array.isArray(revision.previous_attachments) ? revision.previous_attachments : [];
  const nextAttachments = Array.isArray(revision.next_attachments) ? revision.next_attachments : [];
  const removedAttachments = previousAttachments.filter((attachment) => !nextAttachments.some((next) => next.url === attachment.url));
  const addedAttachments = nextAttachments.filter((attachment) => !previousAttachments.some((previous) => previous.url === attachment.url));

  return (
    <div className="admin-dialog-backdrop" onMouseDown={onClose}>
      <section className="revision-diff-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>История правки</span>
            <h2>До и после</h2>
          </div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="revision-diff-grid">
          <article>
            <strong>До</strong>
            <DiffText value={revision.previous_body} compareTo={revision.next_body} mode="removed" />
            <DiffAttachments attachments={removedAttachments} mode="removed" />
          </article>
          <article>
            <strong>После</strong>
            <DiffText value={revision.next_body} compareTo={revision.previous_body} mode="added" />
            <DiffAttachments attachments={addedAttachments} mode="added" />
          </article>
        </div>
      </section>
    </div>
  );
}

function DiffText({ value, compareTo, mode }: { value: string; compareTo: string; mode: "added" | "removed" }) {
  const parts = diffWords(value, compareTo, mode);
  if (!value.trim()) return <p className="revision-empty">Текста нет.</p>;
  return (
    <p className="revision-diff-text">
      {parts.map((part, index) => (
        <span className={part.changed ? mode : ""} key={`${part.text}-${index}`}>{part.text}</span>
      ))}
    </p>
  );
}

function DiffAttachments({ attachments, mode }: { attachments: SubmissionAttachment[]; mode: "added" | "removed" }) {
  if (!attachments.length) return null;
  return (
    <div className={`revision-attachments ${mode}`}>
      {attachments.map((attachment) => (
        <span key={attachment.url}><Paperclip size={13} />{attachment.name}</span>
      ))}
    </div>
  );
}

function diffWords(value: string, compareTo: string, mode: "added" | "removed"): Array<{ text: string; changed: boolean }> {
  const words = value.split(/(\s+)/);
  const compareWords = new Set(compareTo.split(/\s+/).filter(Boolean));
  return words.map((word) => {
    const normalized = word.trim();
    return {
      text: word,
      changed: Boolean(normalized) && !compareWords.has(normalized) && (mode === "added" || mode === "removed")
    };
  });
}

function UploadProgress({ label, progress }: { label: string; progress: number | null }) {
  const percent = progress === null ? null : Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="admin-upload-progress">
      <span>{label}</span>
      <strong>{percent === null ? "Загрузка..." : `${percent}%`}</strong>
      <i style={{ width: `${percent ?? 42}%` }} />
    </div>
  );
}

function AttachmentList({ attachments, onRemove }: { attachments: SubmissionAttachment[]; onRemove?: (index: number) => void }) {
  if (!attachments.length) return null;
  return (
    <div className="admin-assignment-attachments">
      {attachments.map((attachment, index) => (
        <a className={`attachment-preview ${attachmentPreviewKind(attachment)}`} href={attachment.url} target="_blank" rel="noreferrer" key={`${attachment.url}-${index}`}>
          {attachmentPreviewKind(attachment) === "image" ? <img src={attachment.url} alt="" onError={(event) => { event.currentTarget.hidden = true; const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.hidden = false; }} /> : null}
          {attachmentPreviewKind(attachment) === "image" ? <span role="alert" hidden>Изображение недоступно</span> : null}
          {attachmentPreviewKind(attachment) === "video" ? (
            <span className="attachment-preview-icon"><Video size={18} /></span>
          ) : null}
          {attachmentPreviewKind(attachment) === "document" ? (
            <span className="attachment-preview-icon"><FileText size={18} /></span>
          ) : null}
          <span>{attachment.name}</span>
          {onRemove ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onRemove(index);
              }}
            >
              <X size={14} />
            </button>
          ) : null}
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

function pickPanelFile(choice: "media" | "document"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = choice === "media"
      ? "image/*,audio/*,video/*"
      : ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.epub,.fb2,.zip,.rar,*/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
