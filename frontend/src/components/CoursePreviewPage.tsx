import { ArrowLeft, Check, Download, FileText, Menu, Play, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { listLessonQuizResponses, listMyLessonQuizResponses, saveMyLessonQuizResponse } from "../api/courseDatasource";
import type { CourseCurriculum, EditorContent, Lesson, LessonQuizResponseWithUser } from "../entities/course/course";
import type { Language, TranslationKey } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

type CoursePreviewPageProps = {
  curriculum: CourseCurriculum;
  initialLessonId: string;
  language: Language;
  t: (key: TranslationKey) => string;
  onLanguageChange: (language: Language) => void;
  onLogout: () => void;
  onAdminOpen?: () => void;
  onLandingOpen?: () => void;
  onBack?: () => void;
  backLabel?: string;
  enableQuizResponses?: boolean;
  enableQuizStats?: boolean;
};

export function CoursePreviewPage({
  curriculum,
  initialLessonId,
  language,
  t,
  onLanguageChange,
  onLogout,
  onAdminOpen,
  onLandingOpen,
  onBack,
  backLabel,
  enableQuizResponses = false,
  enableQuizStats = false
}: CoursePreviewPageProps) {
  const lessons = useMemo(
    () => curriculum.sections.flatMap((section) => Array.isArray(section.lessons) ? section.lessons : []),
    [curriculum.sections]
  );
  const activeLessonStorageKey = `logos_voice_active_lesson_${curriculum.course.id}`;
  const [activeLessonId, setActiveLessonId] = useState(() =>
    initialLessonId || getStoredLessonId(activeLessonStorageKey, lessons) || lessons[0]?.id || ""
  );
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const activeLessonIdRef = useRef(activeLessonId);
  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId) || lessons[0];
  const [quizResponses, setQuizResponses] = useState<Record<string, number>>({});
  const [quizStatsResponses, setQuizStatsResponses] = useState<LessonQuizResponseWithUser[]>([]);
  const [toastMessage, setToastMessage] = useState("");
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadQuizResponses() {
      if (!enableQuizResponses || !activeLesson) {
        setQuizResponses({});
        return;
      }

      const responses = await listMyLessonQuizResponses(activeLesson.id);
      if (cancelled) return;

      setQuizResponses(
        Object.fromEntries(responses.map((response) => [response.quiz_id, response.selected_option_index]))
      );
    }

    void loadQuizResponses().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activeLesson?.id, enableQuizResponses]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuizStats() {
      if (!enableQuizStats || !activeLesson) {
        setQuizStatsResponses([]);
        return;
      }

      const responses = await listLessonQuizResponses(activeLesson.id);
      if (!cancelled) {
        setQuizStatsResponses(responses);
      }
    }

    void loadQuizStats().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activeLesson?.id, enableQuizStats]);

  useEffect(() => {
    activeLessonIdRef.current = activeLessonId;
    if (activeLessonId) {
      window.localStorage.setItem(activeLessonStorageKey, activeLessonId);
    }
  }, [activeLessonId]);

  useEffect(() => {
    if (!activeLessonId || lessons.some((lesson) => lesson.id === activeLessonId)) return;

    setActiveLessonId(getStoredLessonId(activeLessonStorageKey, lessons) || lessons[0]?.id || "");
  }, [activeLessonId, activeLessonStorageKey, lessons]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeLessonIdRef.current) {
        scrollPositionsRef.current[activeLessonIdRef.current] = window.scrollY;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  function selectLesson(lessonId: string) {
    if (activeLessonIdRef.current) {
      scrollPositionsRef.current[activeLessonIdRef.current] = window.scrollY;
    }

    setActiveLessonId(lessonId);
    setIsCurriculumOpen(false);

    window.requestAnimationFrame(() => {
      const restoredScroll = scrollPositionsRef.current[lessonId];
      if (typeof restoredScroll === "number") {
        window.scrollTo({ top: restoredScroll, behavior: "auto" });
        return;
      }

      document.querySelector(".preview-course-shell")?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
    });
  }

  function showToast(message: string) {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToastMessage(""), 1800);
  }

  return (
    <main className="course-preview">
      <header className="preview-nav">
        <button className="preview-brand" type="button" onClick={onLandingOpen}>
          <strong>LOGOS</strong>
          <span>VOICE</span>
        </button>
        <div className="preview-nav-actions">
          {onAdminOpen ? <button type="button" onClick={onAdminOpen}>{t("adminPanel")}</button> : null}
          {onBack ? (
            <button type="button" onClick={onBack}>
              <ArrowLeft size={18} />
              {backLabel || t("backToEditor")}
            </button>
          ) : null}
          <LanguageSwitcher language={language} onChange={onLanguageChange} />
          <button type="button" onClick={onLogout}>{t("logout")}</button>
        </div>
      </header>

      <button className="preview-curriculum-toggle" type="button" onClick={() => setIsCurriculumOpen(true)}>
        <Menu size={18} />
        {t("curriculum")}
      </button>

      <section className="preview-course-shell">
        {isCurriculumOpen ? (
          <div className="preview-curriculum-backdrop" onMouseDown={() => setIsCurriculumOpen(false)} />
        ) : null}

        <aside className={`preview-curriculum${isCurriculumOpen ? " open" : ""}`}>
          <button className="preview-curriculum-close" type="button" onClick={() => setIsCurriculumOpen(false)}>
            <X size={18} />
            {t("close")}
          </button>
          <div className="preview-course-summary">
            <span>{lessons.length} {t("lessons")}</span>
            <strong>{curriculum.course.title}</strong>
          </div>
          {curriculum.sections.map((section) => (
            <div className="preview-section" key={section.id}>
              <h2>
                <span>{t("section")}</span>
                {section.title}
              </h2>
              {(Array.isArray(section.lessons) ? section.lessons : []).map((lesson) => (
                <button
                  key={lesson.id}
                  className={lesson.id === activeLesson?.id ? "active" : ""}
                  type="button"
                  onClick={() => selectLesson(lesson.id)}
                >
                  <span>{lesson.title}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <article className="preview-lesson">
          {activeLesson ? (
            <>
              <span className="preview-kicker">{t("lessonPreview")}</span>
              <h2>{activeLesson.title}</h2>
              <LessonViewer
                lesson={activeLesson}
                t={t}
                quizResponses={quizResponses}
                quizStatsResponses={quizStatsResponses}
                onQuizAnswer={
                  enableQuizResponses
                    ? async (quizId, selectedOptionIndex) => {
                        const previousOptionIndex = quizResponses[quizId];
                        const isChanged =
                          typeof previousOptionIndex === "number" && previousOptionIndex !== selectedOptionIndex;
                        setQuizResponses((current) => ({ ...current, [quizId]: selectedOptionIndex }));
                        const response = await saveMyLessonQuizResponse({
                          lessonId: activeLesson.id,
                          quizId,
                          selectedOptionIndex
                        });
                        setQuizResponses((current) => ({
                          ...current,
                          [response.quiz_id]: response.selected_option_index
                        }));
                        showToast(isChanged ? t("voteChanged") : t("voteRecorded"));
                      }
                    : undefined
                }
              />
            </>
          ) : (
            <p>{t("noLessonSelected")}</p>
          )}
        </article>
      </section>
      {toastMessage ? <div className="preview-toast">{toastMessage}</div> : null}
    </main>
  );
}

function LessonViewer({
  lesson,
  t,
  quizResponses,
  quizStatsResponses,
  onQuizAnswer
}: {
  lesson: Lesson;
  t: (key: TranslationKey) => string;
  quizResponses: Record<string, number>;
  quizStatsResponses: LessonQuizResponseWithUser[];
  onQuizAnswer?: (quizId: string, selectedOptionIndex: number) => Promise<void>;
}) {
  const content = lesson.draft_content as EditorContent;
  const blocks = Array.isArray(content?.blocks) ? content.blocks : [];

  return (
    <div className="preview-blocks">
      {blocks.map((block, index) => {
        const type = String(block.type || "");
        const data = (block.data || {}) as Record<string, unknown>;

        if (type === "paragraph") {
          return (
            <p
              key={index}
              dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(String(data.text || "")) }}
            />
          );
        }

        if (type === "header") {
          const text = String(data.text || "");
          return <h3 key={index}>{text}</h3>;
        }

        if (type === "list") {
          const items = normalizeTextItems(data.items);
          return (
            <ul key={index}>
              {items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        if (type === "checklist") {
          const items = Array.isArray(data.items) ? data.items : [];
          return (
            <div className="preview-checklist" key={index}>
              {items.map((item, itemIndex) => {
                const value = item as { text?: string; checked?: boolean };
                return (
                  <div key={`${value.text || itemIndex}-${itemIndex}`}>
                    <Check size={16} />
                    <span>{value.text || "Checklist item"}</span>
                  </div>
                );
              })}
            </div>
          );
        }

        if (type === "imageUrl") {
          const imageWidth = getImageWidthStyle(data.width);
          return (
            <figure className="preview-image" key={index} style={imageWidth ? { width: imageWidth } : undefined}>
              <img src={String(data.url || "")} alt={String(data.caption || "")} />
            </figure>
          );
        }

        if (type === "videoUrl") {
          return (
            <div className="preview-video" key={index}>
              {data.url ? (
                <iframe
                  src={disableVideoAutoplay(String(data.url))}
                  allow="accelerometer; gyroscope; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div>
                  <Play size={34} />
                  <span>{String(data.name || "Video lesson")}</span>
                </div>
              )}
            </div>
          );
        }

        if (type === "pdfUrl") {
          return (
            <a className="preview-file" href={String(data.url || "#")} key={index} download>
              <FileText size={24} />
              <span>{String(data.name || "Course file.pdf")}</span>
              <Download size={18} />
            </a>
          );
        }

        if (type === "quiz") {
          const options = normalizeTextItems(data.options);
          const quizId = String(data.id || block.id || `quiz-${index}`);
          return (
            <QuizPreview
              key={index}
              quizId={quizId}
              question={String(data.question || "Question")}
              options={options}
              selectedOptionIndex={quizResponses[quizId]}
              statsResponses={quizStatsResponses.filter((response) => response.quiz_id === quizId)}
              t={t}
              onQuizAnswer={onQuizAnswer}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

function QuizPreview({
  quizId,
  question,
  options,
  selectedOptionIndex,
  statsResponses,
  t,
  onQuizAnswer
}: {
  quizId: string;
  question: string;
  options: string[];
  selectedOptionIndex?: number;
  statsResponses: LessonQuizResponseWithUser[];
  t: (key: TranslationKey) => string;
  onQuizAnswer?: (quizId: string, selectedOptionIndex: number) => Promise<void>;
}) {
  const [votersDialog, setVotersDialog] = useState<{
    option: string;
    optionIndex: number;
    voters: LessonQuizResponseWithUser[];
  } | null>(null);
  const totalVotes = statsResponses.length;
  const showStats = statsResponses.length > 0 || !onQuizAnswer;

  return (
    <>
      <div className="preview-quiz">
        <span>{showStats ? t("quizResults") : t("quiz")}</span>
        <strong>{question}</strong>
        {options.map((option, optionIndex) => {
          const optionVotes = statsResponses.filter((response) => response.selected_option_index === optionIndex);
          const percentage = totalVotes > 0 ? Math.round((optionVotes.length / totalVotes) * 100) : 0;

          return (
            <div className="preview-quiz-option" key={`${option}-${optionIndex}`}>
              <button
                className={selectedOptionIndex === optionIndex ? "selected" : ""}
                type="button"
                onClick={() => {
                  if (onQuizAnswer) {
                    void onQuizAnswer(quizId, optionIndex);
                  }
                }}
              >
                <i>{optionIndex + 1}</i>
                <span>{option}</span>
                {showStats ? <em>{percentage}%</em> : null}
              </button>

              {showStats ? (
                <>
                  <div className="preview-quiz-meter">
                    <span style={{ width: `${percentage}%` }} />
                  </div>
                  <button
                    className="preview-quiz-votes-toggle"
                    type="button"
                    onClick={() => setVotersDialog({ option, optionIndex, voters: optionVotes })}
                  >
                    {t("showVotes")} · {optionVotes.length} {t("votes")}
                  </button>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {votersDialog ? (
        <div className="quiz-voters-dialog-backdrop" onMouseDown={() => setVotersDialog(null)}>
          <section
            className="quiz-voters-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("showVotes")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>{t("quizResults")}</span>
                <strong>{votersDialog.option}</strong>
              </div>
              <button type="button" onClick={() => setVotersDialog(null)}>
                ×
              </button>
            </header>
            <div className="quiz-voters-dialog-list">
              {votersDialog.voters.length === 0 ? <p>{t("noVotes")}</p> : null}
              {votersDialog.voters.map((response) => (
                <article key={response.id}>
                  <strong>{response.user_full_name || response.user_email}</strong>
                  <span>{response.user_email}</span>
                  <small>{new Date(response.updated_at).toLocaleString()}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function normalizeTextItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && "content" in item) {
      return String((item as { content?: string }).content || "");
    }
    return String(item || "");
  });
}

function sanitizeInlineHtml(value: string): string {
  return value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function getImageWidthStyle(value: unknown): string | undefined {
  const width = Number(value);
  if (!Number.isFinite(width)) return undefined;

  return `${Math.min(100, Math.max(35, width))}%`;
}

function disableVideoAutoplay(url: string): string {
  try {
    const parsedURL = new URL(url);
    parsedURL.searchParams.set("autoplay", "false");
    return parsedURL.toString();
  } catch {
    return url;
  }
}

function getStoredLessonId(storageKey: string, lessons: Lesson[]): string {
  const storedLessonId = window.localStorage.getItem(storageKey) || "";
  return lessons.some((lesson) => lesson.id === storedLessonId) ? storedLessonId : "";
}
