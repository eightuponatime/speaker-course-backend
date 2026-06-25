import { ArrowLeft, CalendarDays, Check, Download, FileText, Menu, Play, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  listLessonQuizResponses,
  listMyLessonQuizResponses,
  markCourseActivityOffline,
  markCourseActivityOfflineKeepalive,
  saveMyLessonQuizResponse,
  trackCourseActivity
} from "../api/courseDatasource";
import logosVoiceLogo from "../../assets/images/transparent_logo.png";
import type { CourseCurriculum, EditorContent, Lesson, LessonQuizResponseWithUser } from "../entities/course/course";
import type { TranslationKey } from "../i18n";

type CoursePreviewPageProps = {
  curriculum: CourseCurriculum;
  initialLessonId: string;
  t: (key: TranslationKey) => string;
  onLogout: () => void;
  onAdminOpen?: () => void;
  onLandingOpen?: () => void;
  onProfileOpen?: () => void;
  onBack?: () => void;
  backLabel?: string;
  enableQuizResponses?: boolean;
  enableQuizStats?: boolean;
  enableActivityTracking?: boolean;
  storageScope?: string;
  isPreviewMode?: boolean;
};

export function CoursePreviewPage({
  curriculum,
  initialLessonId,
  t,
  onLogout,
  onAdminOpen,
  onLandingOpen,
  onProfileOpen,
  onBack,
  backLabel,
  enableQuizResponses = false,
  enableQuizStats = false,
  enableActivityTracking = false,
  storageScope = "anonymous",
  isPreviewMode = false
}: CoursePreviewPageProps) {
  const lessons = useMemo(
    () => curriculum.sections.flatMap((section) => Array.isArray(section.lessons) ? section.lessons : []),
    [curriculum.sections]
  );
  const storageKeyPrefix = `${curriculum.course.id}_${stableStoragePart(storageScope)}`;
  const activeLessonStorageKey = `logos_voice_active_lesson_${storageKeyPrefix}`;
  const scrollStorageKey = `logos_voice_lesson_scroll_${storageKeyPrefix}`;
  const videoStoragePrefix = `logos_voice_video_progress_${storageKeyPrefix}`;
  const [activeLessonId, setActiveLessonId] = useState(() =>
    getStoredLessonId(activeLessonStorageKey, lessons) || initialLessonId || lessons[0]?.id || ""
  );
  const scrollPositionsRef = useRef<Record<string, number>>(readJSONStorage<Record<string, number>>(scrollStorageKey, {}));
  const activeLessonIdRef = useRef(activeLessonId);
  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId) || lessons[0];
  const activeLessonIndex = activeLesson ? lessons.findIndex((lesson) => lesson.id === activeLesson.id) : -1;
  const previousLesson = activeLessonIndex > 0 ? lessons[activeLessonIndex - 1] : undefined;
  const nextLesson =
    activeLessonIndex >= 0 && activeLessonIndex < lessons.length - 1 ? lessons[activeLessonIndex + 1] : undefined;
  const [quizResponses, setQuizResponses] = useState<Record<string, number>>({});
  const [quizStatsResponses, setQuizStatsResponses] = useState<LessonQuizResponseWithUser[]>([]);
  const [toastMessage, setToastMessage] = useState("");
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
  const [isAccessPopoverOpen, setIsAccessPopoverOpen] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const curriculumRef = useRef<HTMLElement | null>(null);
  const activeLessonButtonRef = useRef<HTMLButtonElement | null>(null);
  const activityOnlineRef = useRef(false);

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
  }, [activeLessonId, activeLessonStorageKey]);

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
        writeJSONStorage(scrollStorageKey, scrollPositionsRef.current);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [scrollStorageKey]);

  useEffect(() => {
    if (!activeLessonId) return;

    const storedScroll = scrollPositionsRef.current[activeLessonId];
    if (typeof storedScroll !== "number") return;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: storedScroll, behavior: "auto" });
    });
  }, []);

  useEffect(() => {
    const activeButton = activeLessonButtonRef.current;
    const curriculumElement = curriculumRef.current;
    if (!activeButton || !curriculumElement) return;
    if (curriculumElement.scrollHeight <= curriculumElement.clientHeight) return;

    const buttonTop = activeButton.offsetTop;
    const buttonBottom = buttonTop + activeButton.offsetHeight;
    const visibleTop = curriculumElement.scrollTop;
    const visibleBottom = visibleTop + curriculumElement.clientHeight;

    if (buttonTop < visibleTop || buttonBottom > visibleBottom) {
      activeButton.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeLessonId, isCurriculumOpen]);

  useEffect(() => {
    if (!enableActivityTracking || !activeLesson?.id) return;

    let stopped = false;
    const sendActivity = () => {
      if (stopped || document.visibilityState === "hidden") return;

      void trackCourseActivity({
        courseId: curriculum.course.id,
        lessonId: activeLesson.id
      })
        .then(() => {
          activityOnlineRef.current = true;
        })
        .catch(() => undefined);
    };

    const markOffline = () => {
      if (!activityOnlineRef.current) return;
      activityOnlineRef.current = false;
      markCourseActivityOfflineKeepalive(curriculum.course.id);
    };

    const firstTimer = window.setTimeout(sendActivity, 4000);
    const interval = window.setInterval(sendActivity, 20000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendActivity();
      } else {
        markOffline();
      }
    };
    const handlePageHide = () => markOffline();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      stopped = true;
      window.clearTimeout(firstTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      markOffline();
    };
  }, [activeLesson?.id, curriculum.course.id, enableActivityTracking]);

  async function handleLogoutClick() {
    if (enableActivityTracking) {
      activityOnlineRef.current = false;
      await markCourseActivityOffline(curriculum.course.id).catch(() => undefined);
    }

    onLogout();
  }

  function selectLesson(lessonId: string) {
    if (activeLessonIdRef.current) {
      scrollPositionsRef.current[activeLessonIdRef.current] = window.scrollY;
      writeJSONStorage(scrollStorageKey, scrollPositionsRef.current);
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
          <img src={logosVoiceLogo} alt="" />
          <span>
            <strong>LOGOS</strong>
            <small>VOICE</small>
          </span>
        </button>
        <div className="preview-nav-actions">
          {curriculum.access?.access_expires_at ? (
            <div className="preview-access-menu">
              <button
                className="preview-access-button"
                type="button"
                onClick={() => setIsAccessPopoverOpen((current) => !current)}
              >
                <CalendarDays size={17} />
                Доступ до {formatShortDate(curriculum.access.access_expires_at)}
              </button>
              {isAccessPopoverOpen ? (
                <div className="preview-access-popover">
                  <strong>{formatAccessDaysLeft(curriculum.access.access_expires_at)}</strong>
                  <span>Открыт до {formatDate(curriculum.access.access_expires_at)}</span>
                  {curriculum.access.first_access_at ? (
                    <small>Первый вход: {formatDate(curriculum.access.first_access_at)}</small>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {onAdminOpen ? <button type="button" onClick={onAdminOpen}>{t("adminPanel")}</button> : null}
          {onBack ? (
            <button type="button" onClick={onBack}>
              <ArrowLeft size={18} />
              {backLabel || t("backToEditor")}
            </button>
          ) : null}
          {onProfileOpen ? <button type="button" onClick={onProfileOpen}>Профиль</button> : null}
          <button type="button" onClick={handleLogoutClick}>{t("logout")}</button>
        </div>
      </header>

      <button className="preview-curriculum-toggle" type="button" onClick={() => setIsCurriculumOpen(true)}>
        <Menu size={18} />
        {t("curriculum")}
      </button>

      {isPreviewMode ? (
        <div className="preview-mode-banner" role="status">
          <strong>Предпросмотр курса</strong>
          <span>Вы смотрите курс глазами ученика. Изменения в уроках в этом режиме не редактируются.</span>
        </div>
      ) : null}

      <section className="preview-course-shell">
        {isCurriculumOpen ? (
          <div className="preview-curriculum-backdrop" onMouseDown={() => setIsCurriculumOpen(false)} />
        ) : null}

        <aside className={`preview-curriculum${isCurriculumOpen ? " open" : ""}`} ref={curriculumRef}>
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
                  ref={lesson.id === activeLesson?.id ? activeLessonButtonRef : undefined}
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
                courseId={curriculum.course.id}
                videoStoragePrefix={videoStoragePrefix}
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
              <LessonNavigation
                previousLesson={previousLesson}
                nextLesson={nextLesson}
                onSelectLesson={selectLesson}
                placement="bottom"
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

function LessonNavigation({
  previousLesson,
  nextLesson,
  onSelectLesson,
  placement = "top"
}: {
  previousLesson?: Lesson;
  nextLesson?: Lesson;
  onSelectLesson: (lessonId: string) => void;
  placement?: "top" | "bottom";
}) {
  if (!previousLesson && !nextLesson) return null;

  return (
    <nav className={`preview-lesson-navigation ${placement}`} aria-label="Навигация по урокам">
      <button type="button" disabled={!previousLesson} onClick={() => previousLesson && onSelectLesson(previousLesson.id)}>
        <span>Предыдущий урок</span>
        <strong>{previousLesson?.title || "Нет предыдущего урока"}</strong>
      </button>
      <button type="button" disabled={!nextLesson} onClick={() => nextLesson && onSelectLesson(nextLesson.id)}>
        <span>Следующий урок</span>
        <strong>{nextLesson?.title || "Нет следующего урока"}</strong>
      </button>
    </nav>
  );
}

function LessonViewer({
  lesson,
  courseId,
  videoStoragePrefix,
  t,
  quizResponses,
  quizStatsResponses,
  onQuizAnswer
}: {
  lesson: Lesson;
  courseId: string;
  videoStoragePrefix: string;
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
          const videoUrl = String(data.url || "");
          const videoId = String(data.id || block.id || data.video_id || data.name || index);
          return (
            <PersistentVideo
              key={index}
              courseId={courseId}
              lessonId={lesson.id}
              storagePrefix={videoStoragePrefix}
              videoId={videoId}
              url={videoUrl}
              name={String(data.name || "Video lesson")}
            />
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

function PersistentVideo({
  courseId,
  lessonId,
  storagePrefix,
  videoId,
  url,
  name
}: {
  courseId: string;
  lessonId: string;
  storagePrefix: string;
  videoId: string;
  url: string;
  name: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSavedSecondRef = useRef(0);
  const storageKey = `${storagePrefix}_${lessonId}_${stableStoragePart(videoId)}_${stableStoragePart(url)}`;
  const initialProgress = readVideoProgress(storageKey);

  function saveProgress(seconds: number, duration?: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    if (Math.abs(seconds - lastSavedSecondRef.current) < 2) return;

    lastSavedSecondRef.current = seconds;
    writeJSONStorage(storageKey, {
      courseId,
      lessonId,
      videoId,
      url,
      seconds,
      duration,
      updatedAt: new Date().toISOString()
    });
  }

  useEffect(() => {
    if (!url || isDirectVideoUrl(url)) return;

    const iframe = iframeRef.current;
    const targetWindow = iframe?.contentWindow;
    if (!iframe || !targetWindow) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== targetWindow) return;

      const payload = parseMessageData(event.data);
      const progress = extractPlayerProgress(payload);
      if (progress) {
        saveProgress(progress.seconds, progress.duration);
      }
    };

    const requestTimer = window.setInterval(() => {
      postPlayerMessage(targetWindow, { method: "getCurrentTime" });
      postPlayerMessage(targetWindow, { method: "getDuration" });
    }, 3000);

    const handleLoad = () => {
      if (initialProgress.seconds > 2) {
        postPlayerMessage(targetWindow, { method: "setCurrentTime", value: initialProgress.seconds });
        postPlayerMessage(targetWindow, { method: "seek", value: initialProgress.seconds });
      }

      postPlayerMessage(targetWindow, { method: "addEventListener", value: "timeupdate" });
      postPlayerMessage(targetWindow, { method: "addEventListener", value: "pause" });
    };

    window.addEventListener("message", handleMessage);
    iframe.addEventListener("load", handleLoad);
    handleLoad();

    return () => {
      window.clearInterval(requestTimer);
      iframe.removeEventListener("load", handleLoad);
      window.removeEventListener("message", handleMessage);
    };
  }, [initialProgress.seconds, url]);

  if (!url) {
    return (
      <div className="preview-video">
        <div>
          <Play size={34} />
          <span>{name}</span>
        </div>
      </div>
    );
  }

  if (isDirectVideoUrl(url)) {
    return (
      <div className="preview-video">
        <video
          controls
          preload="metadata"
          src={url}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (initialProgress.seconds > 2 && initialProgress.seconds < video.duration - 2) {
              video.currentTime = initialProgress.seconds;
            }
          }}
          onTimeUpdate={(event) => saveProgress(event.currentTarget.currentTime, event.currentTarget.duration)}
          onPause={(event) => saveProgress(event.currentTarget.currentTime, event.currentTarget.duration)}
        />
      </div>
    );
  }

  return (
    <div className="preview-video">
      <iframe
        ref={iframeRef}
        src={withVideoStartTime(disableVideoAutoplay(url), initialProgress.seconds)}
        allow="accelerometer; gyroscope; encrypted-media; picture-in-picture"
        allowFullScreen
      />
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

function withVideoStartTime(url: string, seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 2) return url;

  try {
    const parsedURL = new URL(url);
    const roundedSeconds = String(Math.floor(seconds));
    parsedURL.searchParams.set("start", roundedSeconds);
    parsedURL.searchParams.set("t", roundedSeconds);
    return parsedURL.toString();
  } catch {
    return url;
  }
}

function isDirectVideoUrl(url: string): boolean {
  try {
    const parsedURL = new URL(url);
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(parsedURL.pathname);
  } catch {
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
  }
}

function readVideoProgress(storageKey: string): { seconds: number; duration?: number } {
  const progress = readJSONStorage<{ seconds?: number; duration?: number }>(storageKey, {});
  return {
    seconds: Number.isFinite(progress.seconds) ? Number(progress.seconds) : 0,
    duration: Number.isFinite(progress.duration) ? Number(progress.duration) : undefined
  };
}

function postPlayerMessage(targetWindow: Window, payload: Record<string, unknown>) {
  targetWindow.postMessage(
    {
      context: "player.js",
      version: "0.0.11",
      ...payload
    },
    "*"
  );
}

function parseMessageData(data: unknown): unknown {
  if (typeof data !== "string") return data;

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function extractPlayerProgress(payload: unknown): { seconds: number; duration?: number } | null {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;
  const value = data.value;
  const directSeconds = firstFiniteNumber(data.seconds, data.currentTime, data.time);

  if (directSeconds !== null) {
    return {
      seconds: directSeconds,
      duration: firstFiniteNumber(data.duration) ?? undefined
    };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const method = String(data.method || data.event || "");
    if (/time|current/i.test(method)) {
      return { seconds: value };
    }
  }

  if (value && typeof value === "object") {
    const valueRecord = value as Record<string, unknown>;
    const seconds = firstFiniteNumber(valueRecord.seconds, valueRecord.currentTime, valueRecord.time);
    if (seconds !== null) {
      return {
        seconds,
        duration: firstFiniteNumber(valueRecord.duration) ?? undefined
      };
    }
  }

  return null;
}

function firstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }

  return null;
}

function stableStoragePart(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function readJSONStorage<T>(storageKey: string, fallback: T): T {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSONStorage(storageKey: string, value: unknown) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

function getStoredLessonId(storageKey: string, lessons: Lesson[]): string {
  const storedLessonId = window.localStorage.getItem(storageKey) || "";
  return lessons.some((lesson) => lesson.id === storedLessonId) ? storedLessonId : "";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit"
  });
}

function formatAccessDaysLeft(value: string): string {
  const msLeft = new Date(value).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
  if (daysLeft === 1) return "Остался 1 день для прохождения курса";
  if (daysLeft >= 2 && daysLeft <= 4) return `Осталось ${daysLeft} дня для прохождения курса`;
  return `Осталось ${daysLeft} дней для прохождения курса`;
}
