import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EditorJS from "@editorjs/editorjs";
import * as tus from "tus-js-client";

import { getMe, login, logout as logoutUser, register } from "./api/authDatasource";
import {
  createLesson,
  createSection,
  getAdminPrimaryCourseCurriculum,
  listCourseEnrollments,
  publishCourse,
  publishLesson,
  reorderLessons,
  saveLessonDraft,
  updateSection,
  updateLesson
} from "./api/courseDatasource";
import { apiBaseUrl } from "./api/http";
import {
  completeStreamUpload,
  createStreamUpload,
  getStreamVideoStatus,
  uploadStorageAsset
} from "./api/mediaDatasource";
import { CourseTopbar } from "./components/CourseTopbar";
import { CourseAccessPage } from "./components/CourseAccessPage";
import { CoursePreviewPage } from "./components/CoursePreviewPage";
import { CurriculumSidebar } from "./components/CurriculumSidebar";
import { EnrollmentRequestsPanel } from "./components/EnrollmentRequestsPanel";
import { LessonWorkspace } from "./components/LessonWorkspace";
import { LandingPage } from "./components/LandingPage";
import { ProfileSettingsModal } from "./components/ProfileSettingsModal";
import { StudentActivityPanel } from "./components/StudentActivityPanel";
import type { BlockType } from "./components/BlockToolbar";
import type { CourseCurriculum, EditorContent, Lesson, User } from "./entities/course/course";
import type { StreamVideoStatus } from "./entities/media/media";
import { translate } from "./i18n";
import { markExternalAuthSyncActive, notifyAuthChanged, subscribeToAuthChanges } from "./authSync";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const isAdminRoute = path.startsWith("/admin");
  const isCourseRoute = path.startsWith("/course");
  const [curriculum, setCurriculum] = useState<CourseCurriculum | null>(null);
  const [activeLessonId, setActiveLessonId] = useState("");
  const [error, setError] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<"curriculum" | "activity" | "requests">("curriculum");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const editorRef = useRef<EditorJS | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);

  const addDebug = useCallback((message: string) => {
    console.log(`[course-builder] ${message}`);
  }, []);
  const t = useCallback((key: Parameters<typeof translate>[1]) => translate("ru", key), []);

  const navigate = useCallback((nextPath: string) => {
    window.history.pushState(null, "", nextPath);
    setPath(nextPath);
  }, []);

  function loadCurriculum(preferredLessonId?: string, forceAdminAccess = currentUser?.role === "admin") {
    const shouldUseAdminAccess = isAdminRoute || forceAdminAccess;

    getAdminPrimaryCourseCurriculum()
      .then((data) => {
        const normalizedData = normalizeCurriculum(data);
        setCurriculum(normalizedData);
        const lessons = normalizedData.sections.flatMap((section) => safeLessons(section.lessons));
        const nextActiveLessonId =
          preferredLessonId && lessons.some((lesson) => lesson.id === preferredLessonId)
            ? preferredLessonId
            : lessons[0]?.id ?? "";

        setActiveLessonId(nextActiveLessonId);
        if (shouldUseAdminAccess) {
          loadPendingRequestsCount(normalizedData.course.id);
        }
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load curriculum");
      });
  }

  async function loadPendingRequestsCount(nextCourseId: string) {
    try {
      const pending = await listCourseEnrollments(nextCourseId, "pending");
      setPendingRequestsCount(Array.isArray(pending) ? pending.length : 0);
    } catch (err) {
      addDebug(`pending requests count failed: ${formatError(err)}`);
    }
  }

  const resetAuthenticatedState = useCallback(() => {
    setCurrentUser(null);
    setCurriculum(null);
    setIsPreviewing(false);
    setIsProfileOpen(false);
    setError("");
  }, []);

  const refreshAuthenticatedUser = useCallback(async () => {
    try {
      const user = await getMe();
      setCurrentUser(user);
      setError("");
      if (user.role === "admin") {
        loadCurriculum(undefined, true);
      } else {
        setCurriculum(null);
        setIsPreviewing(false);
        if (window.location.pathname.startsWith("/admin")) {
          navigate("/");
        }
      }
    } catch {
      resetAuthenticatedState();
      if (window.location.pathname.startsWith("/admin")) {
        navigate("/");
      }
    } finally {
      setAuthChecked(true);
    }
  }, [navigate, resetAuthenticatedState]);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    void refreshAuthenticatedUser().then(() => {
      notifyAuthChanged("session");
    });
  }, [refreshAuthenticatedUser]);

  useEffect(() => {
    return subscribeToAuthChanges(() => {
      markExternalAuthSyncActive();
      void refreshAuthenticatedUser();
    });
  }, [refreshAuthenticatedUser]);

  useEffect(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, [activeLessonId]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      addDebug(`window error: ${event.message}`);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      addDebug(`promise error: ${formatError(event.reason)}`);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [addDebug]);

  const activeLesson = useMemo<Lesson | undefined>(() => {
    return curriculum?.sections.flatMap((section) => safeLessons(section.lessons)).find((lesson) => lesson.id === activeLessonId);
  }, [activeLessonId, curriculum]);

  async function handleAddLesson(sectionId: string) {
    if (!curriculum) return;

    const section = curriculum.sections.find((item) => item.id === sectionId);
    if (!section) return;

    const nextPosition = safeLessons(section.lessons).length + 1;
    const title = `New lesson ${nextPosition}`;

    try {
      const lesson = await createLesson({
        courseId: curriculum.course.id,
        sectionId,
        title,
        slug: uniqueLessonSlug(title),
        position: nextPosition
      });

      setActiveLessonId(lesson.id);
      markUnpublishedChanges();
      loadCurriculum(lesson.id);
    } catch (err) {
      setPublishStatus(formatError(err));
    }
  }

  async function handleAddSection() {
    if (!curriculum) return;

    const nextPosition = curriculum.sections.length + 1;
    const title = `New section ${nextPosition}`;

    try {
      await createSection({
        courseId: curriculum.course.id,
        title,
        position: nextPosition
      });

      markUnpublishedChanges();
      loadCurriculum(activeLessonId);
    } catch (err) {
      setPublishStatus(formatError(err));
    }
  }

  async function handleMoveLesson(lessonId: string, toSectionId: string, beforeLessonId: string | null) {
    if (!curriculum || lessonId === beforeLessonId) return;

    const nextCurriculum = moveLessonInCurriculum(curriculum, lessonId, toSectionId, beforeLessonId);
    if (!nextCurriculum) return;

    setCurriculum(nextCurriculum);

    try {
      const payload = nextCurriculum.sections.flatMap((section) =>
        safeLessons(section.lessons).map((lesson, index) => ({
          id: lesson.id,
          section_id: section.id,
          position: index + 1
        }))
      );
      const updated = await reorderLessons(curriculum.course.id, payload);
      setCurriculum(updated);
      setPublishStatus("Lesson order saved");
    } catch (err) {
      setPublishStatus(formatError(err));
      loadCurriculum(activeLessonId);
    }
  }

  async function handleRenameLesson(lessonId: string, title: string) {
    const lesson = curriculum?.sections.flatMap((section) => safeLessons(section.lessons)).find((item) => item.id === lessonId);
    if (!lesson) return;

    try {
      const updatedLesson = await updateLesson({
        lessonId,
        title,
        slug: uniqueLessonSlug(title)
      });

      setCurriculum((current) => {
        if (!current) return current;

        return {
          ...current,
          sections: current.sections.map((section) => ({
            ...section,
            lessons: safeLessons(section.lessons).map((item) => (item.id === lessonId ? updatedLesson : item))
          }))
        };
      });
      markUnpublishedChanges();
      setPublishStatus("Lesson title saved");
    } catch (err) {
      setPublishStatus(formatError(err));
    }
  }

  async function handleRenameSection(sectionId: string, title: string) {
    if (!curriculum) return;
    const section = curriculum.sections.find((item) => item.id === sectionId);
    if (!section || section.title === title) return;

    try {
      const updatedSection = await updateSection({
        courseId: curriculum.course.id,
        sectionId,
        title
      });

      setCurriculum((current) => {
        if (!current) return current;

        return {
          ...current,
          sections: current.sections.map((item) =>
            item.id === sectionId
              ? {
                  ...item,
                  ...updatedSection
                }
              : item
          )
        };
      });
      markUnpublishedChanges();
      setPublishStatus("Section title saved");
    } catch (err) {
      setPublishStatus(formatError(err));
    }
  }

  const handleEditorReady = useCallback((editor: EditorJS | null) => {
    editorRef.current = editor;
    addDebug(editor ? "editor ready -> ref stored" : "editor null -> ref cleared");
  }, [addDebug]);

  const scheduleAutosave = useCallback(() => {
    if (!activeLesson) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    markUnpublishedChanges();
    setPublishStatus("Unsaved changes");
    autosaveTimerRef.current = window.setTimeout(async () => {
      const editor = editorRef.current;
      if (!editor) return;

      try {
        await editor.isReady;
        const content = (await editor.save()) as unknown as EditorContent;

        if (hasPendingMedia(content)) {
          setPublishStatus("Waiting for media processing");
          return;
        }

        setPublishStatus("Saving draft...");
        await saveLessonDraft(activeLesson.id, content);
        setPublishStatus("Draft saved");
      } catch (err) {
        setPublishStatus(formatError(err));
      }
    }, 1200);
  }, [activeLesson]);

  const handleInlineImageUpload = useCallback(
    async (file: File) => {
      if (!curriculum || !activeLesson) {
        throw new Error("Lesson is not selected");
      }

      addDebug("inline image upload started");
      const asset = await uploadStorageAsset({
        file,
        kind: "image",
        courseId: curriculum.course.id,
        lessonId: activeLesson.id
      });
      addDebug("inline image upload finished");

      return {
        url: asset.public_url,
        caption: file.name
      };
    },
    [activeLesson, curriculum]
  );

  const handleInlinePdfUpload = useCallback(
    async (file: File) => {
      if (!curriculum || !activeLesson) {
        throw new Error("Lesson is not selected");
      }

      addDebug("inline pdf upload started");
      const asset = await uploadStorageAsset({
        file,
        kind: "pdf",
        courseId: curriculum.course.id,
        lessonId: activeLesson.id
      });
      addDebug("inline pdf upload finished");

      return {
        url: asset.public_url,
        name: file.name,
        sizeBytes: file.size
      };
    },
    [activeLesson, curriculum]
  );

  const handleInlineVideoUpload = useCallback(
    async (
      file: File,
      onState: (state: { phase: "uploading" | "processing"; progress: number; label: string }) => void
    ) => {
      if (!curriculum || !activeLesson) {
        throw new Error("Lesson is not selected");
      }

      addDebug(`stream create upload: ${file.name}`);
      const credentials = await createStreamUpload(file.name);
      addDebug(`stream credentials ready: video=${credentials.video_id}`);

      await uploadVideoWithTus(file, credentials, (percentage) => {
        onState({
          phase: "uploading",
          progress: percentage,
          label: "Uploading video"
        });
      }, addDebug);
      addDebug(`stream tus upload complete: video=${credentials.video_id}`);

      const asset = await completeStreamUpload({
        courseId: curriculum.course.id,
        lessonId: activeLesson.id,
        videoId: credentials.video_id,
        title: file.name,
        sizeBytes: file.size
      });
      addDebug(`stream asset saved: ${asset.id}`);

      const status = await pollStreamVideoUntilPlayable(credentials.video_id, (status) => {
        const progress = normalizeProcessingProgress(status.encode_progress);
        onState({
          phase: "processing",
          progress,
          label: status.status_label
        });
      });

      return {
        url: status?.embed_url || "",
        name: file.name
      };
    },
    [activeLesson, curriculum]
  );

  async function handleInsertBlock(blockType: BlockType) {
    const editor = editorRef.current;
    addDebug(`click ${blockType}`);
    if (!editor) {
      addDebug("insert stopped: editorRef is null");
      return;
    }

    try {
      await editor.isReady;
      addDebug(
        `editor ready before insert, blocks=${editor.blocks.getBlocksCount()}, domBlocks=${countVisibleEditorBlocks()}`
      );

      if (blockType === "text") {
        const text = `New text block ${editor.blocks.getBlocksCount()}`;
        insertEditorBlock(editor, "paragraph", { text });
        revealInsertedBlock(addDebug, text);
      }
      if (blockType === "video") {
        if (!curriculum || !activeLesson) {
          addDebug("insert stopped: lesson is not selected");
          return;
        }

        const file = await pickFile("video/*");
        if (!file) return;

        const videoBlock = insertEditorBlock(editor, "videoUrl", {
          name: file.name,
          uploading: true,
          processing: false,
          progress: 0
        });
        revealInsertedBlock(addDebug, file.name);

        try {
          const result = await handleInlineVideoUpload(file, (state) => {
            void editor.blocks.update(videoBlock.id, {
              name: file.name,
              uploading: state.phase === "uploading",
              processing: state.phase === "processing",
              progress: state.progress,
              statusLabel: state.label
            });
          });

          if (result.url) {
            const nextVideoData = {
              url: result.url,
              name: result.name,
              uploading: false,
              processing: false,
              progress: 100
            };
            await editor.blocks.update(videoBlock.id, nextVideoData);
            await replaceEditorBlockDataAndRender(editor, videoBlock.id, nextVideoData);
            addDebug("video block rendered");
          }
        } catch (err) {
          await editor.blocks.update(videoBlock.id, {
            name: `${file.name} - upload failed`,
            uploading: false,
            processing: false,
            progress: 0
          });
          throw err;
        }
      }
      if (blockType === "image") {
        if (!curriculum || !activeLesson) {
          addDebug("insert stopped: lesson is not selected");
          return;
        }

        const file = await pickFile("image/*");
        if (!file) return;

        const previewURL = URL.createObjectURL(file);
        const imageBlock = insertEditorBlock(
          editor,
          "imageUrl",
          { url: previewURL, caption: file.name, uploading: true, width: 80 }
        );
        revealInsertedBlock(addDebug, file.name);

        addDebug("toolbar image upload started");
        try {
          const asset = await uploadStorageAsset({
            file,
            kind: "image",
            courseId: curriculum.course.id,
            lessonId: activeLesson.id
          });

          await editor.blocks.update(imageBlock.id, {
            url: asset.public_url,
            caption: file.name,
            uploading: false,
            width: 80
          });
          URL.revokeObjectURL(previewURL);
        } catch (err) {
          await editor.blocks.update(imageBlock.id, {
            url: previewURL,
            caption: `${file.name} - upload failed`,
            uploading: false,
            width: 80
          });
          throw err;
        }
      }
      if (blockType === "quiz") {
        insertEditorBlock(editor, "quiz", {
          id: createClientId("quiz"),
          question: "Question",
          options: ["Option 1", "Option 2"]
        });
        revealInsertedBlock(addDebug, "Question");
      }
      if (blockType === "pdf") {
        if (!curriculum || !activeLesson) {
          addDebug("insert stopped: lesson is not selected");
          return;
        }

        const file = await pickFile("application/pdf");
        if (!file) return;

        addDebug("toolbar pdf upload started");
        const asset = await uploadStorageAsset({
          file,
          kind: "pdf",
          courseId: curriculum.course.id,
          lessonId: activeLesson.id
        });

        insertEditorBlock(editor, "pdfUrl", {
          url: asset.public_url,
          name: file.name,
          sizeBytes: file.size
        });
        revealInsertedBlock(addDebug, file.name);
      }

      addDebug(`done ${blockType}, blocks=${editor.blocks.getBlocksCount()}, domBlocks=${countVisibleEditorBlocks()}`);
    } catch (err) {
      addDebug(`insert ${blockType} failed: ${formatError(err)}`);
    }
  }


  async function authenticateWithPassword(nextEmail: string, nextPassword: string) {
    const user = await login(nextEmail, nextPassword);
    setCurrentUser(user);
    setError("");
    if (user.role === "admin") {
      loadCurriculum(undefined, true);
    }
    notifyAuthChanged("login");
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    await authenticateWithPassword(email, password);
  }

  async function handleLandingLogin(nextEmail: string, nextPassword: string) {
    try {
      await authenticateWithPassword(nextEmail, nextPassword);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleLandingRegister(input: { email: string; password: string; fullName: string }) {
    try {
      const user = await register(input);
      setCurrentUser(user);
      setError("");
      if (user.role === "admin") {
        loadCurriculum(undefined, true);
      }
      notifyAuthChanged("login");
      return user;
    } catch (err) {
      setError(formatError(err));
      throw err;
    }
  }

  async function handleLogout() {
    await logoutUser().catch(() => undefined);
    resetAuthenticatedState();
    notifyAuthChanged("logout");
    if (path.startsWith("/admin")) {
      navigate("/");
    }
  }

  function handleAccountDeleted() {
    resetAuthenticatedState();
    notifyAuthChanged("delete");
    navigate("/");
  }

  function renderProfileModal() {
    if (!currentUser || !isProfileOpen) return null;

    return (
      <ProfileSettingsModal
        user={currentUser}
        onClose={() => setIsProfileOpen(false)}
        onUserChange={(user) => {
          setCurrentUser(user);
          notifyAuthChanged("profile");
        }}
        onAccountDeleted={handleAccountDeleted}
      />
    );
  }

  async function handlePublish() {
    if (!curriculum) return;

    const editor = editorRef.current;
    setIsPublishing(true);
    setPublishStatus("Preparing publish...");

    try {
      if (activeLesson && editor) {
        await editor.isReady;
        const content = (await editor.save()) as unknown as EditorContent;

        if (hasPendingMedia(content)) {
          setPublishStatus("Wait for media processing to finish");
          return;
        }

        setPublishStatus("Saving current lesson...");
        await saveLessonDraft(activeLesson.id, content);
      }

      const lessons = curriculum.sections.flatMap((section) => safeLessons(section.lessons));
      setPublishStatus("Publishing lessons...");
      for (const lesson of lessons) {
        await publishLesson(lesson.id);
      }

      setPublishStatus("Publishing course...");
      await publishCourse(curriculum.course.id);

      setPublishStatus(t("courseStatusPublished"));
      addDebug("course published");
      loadCurriculum(activeLessonId);
    } catch (err) {
      const message = formatError(err);
      setPublishStatus(message);
      addDebug(`publish failed: ${message}`);
    } finally {
      setIsPublishing(false);
    }
  }

  function markUnpublishedChanges() {
    setCurriculum((current) => {
      if (!current || current.has_unpublished_changes) return current;

      return {
        ...current,
        has_unpublished_changes: true
      };
    });
  }

  if (!authChecked) {
    return <main className="auth-check-screen" aria-hidden="true" />;
  }

  if (!currentUser && !isAdminRoute) {
    return (
      <LandingPage
        error={error}
        t={t}
        onLogin={handleLandingLogin}
        onRegister={handleLandingRegister}
      />
    );
  }

  if (!currentUser && isAdminRoute) {
    return (
      <main className="page">
        <form className="login-box" onSubmit={handleLogin}>
          <strong>Admin login</strong>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
          />
          <button type="submit">{t("loginAndLoad")}</button>
          <a href={`${apiBaseUrl}/auth/google/start`}>{t("continueWithGoogle")}</a>
          <p>{error}</p>
        </form>
      </main>
    );
  }

  if (!currentUser) {
    return null;
  }

  const authenticatedUser = currentUser;

  if (!isAdminRoute && !isCourseRoute) {
    return (
      <>
        <LandingPage
          error={error}
          t={t}
          onLogin={handleLandingLogin}
          onRegister={handleLandingRegister}
          currentUser={authenticatedUser}
          onAdminOpen={authenticatedUser.role === "admin" ? () => navigate("/admin") : undefined}
          onLogout={handleLogout}
          onOpenCourse={() => navigate("/course")}
          onProfileOpen={() => setIsProfileOpen(true)}
        />
        {renderProfileModal()}
      </>
    );
  }

  if (authenticatedUser.role !== "admin" && isCourseRoute) {
    return (
      <>
        <CourseAccessPage
          currentUser={authenticatedUser}
          t={t}
          onLogout={handleLogout}
          onLandingOpen={() => navigate("/")}
          onProfileOpen={() => setIsProfileOpen(true)}
        />
        {renderProfileModal()}
      </>
    );
  }

  if (authenticatedUser.role !== "admin" && isAdminRoute) {
    return (
      <main className="course-access-page">
        <section className="course-access-card">
          <div>
            <span>{t("adminPanel")}</span>
            <h1>Access denied</h1>
            <p>{t("accessRejectedText")}</p>
          </div>
          <button type="button" onClick={handleLogout}>
            {t("logout")}
          </button>
        </section>
      </main>
    );
  }

  if (!curriculum) {
    return (
      <main className="page">
        <div className="loading-box">{t("loadingCourse")}</div>
      </main>
    );
  }

  const isAdminMode = isAdminRoute;

  if (!isAdminMode || isPreviewing) {
    return (
      <>
        <CoursePreviewPage
          curriculum={curriculum}
          initialLessonId={activeLessonId}
          t={t}
          onLogout={handleLogout}
          onAdminOpen={
            !isAdminRoute && currentUser?.role === "admin"
              ? () => navigate("/admin")
              : undefined
          }
          onLandingOpen={() => navigate("/")}
          onBack={isPreviewing ? () => setIsPreviewing(false) : undefined}
          onProfileOpen={() => setIsProfileOpen(true)}
          enableQuizStats={currentUser?.role === "admin"}
          storageScope={currentUser?.id || "admin-preview"}
          isPreviewMode={isPreviewing}
        />
        {renderProfileModal()}
      </>
    );
  }

  return (
    <>
      <main className="admin-screen">
        <CourseTopbar
          course={curriculum.course}
          activeTab={activeTab}
          hasUnpublishedChanges={curriculum.has_unpublished_changes}
          pendingRequestsCount={pendingRequestsCount}
          publishStatus={publishStatus}
          isPublishing={isPublishing}
          onTabChange={setActiveTab}
          t={t}
          onLogout={handleLogout}
          onLandingOpen={() => navigate("/")}
          onPreview={() => setIsPreviewing(true)}
          onPublish={handlePublish}
          onProfileOpen={() => setIsProfileOpen(true)}
        />
        {activeTab === "curriculum" ? (
          <div className="page">
            <CurriculumSidebar
              curriculum={curriculum}
              activeLessonId={activeLessonId}
              onSelectLesson={setActiveLessonId}
              onAddSection={handleAddSection}
              onAddLesson={handleAddLesson}
              onMoveLesson={handleMoveLesson}
              onRenameSection={handleRenameSection}
              t={t}
            />

            <LessonWorkspace
              lesson={activeLesson}
              onEditorReady={handleEditorReady}
              onDebug={addDebug}
              onUploadImage={handleInlineImageUpload}
              onUploadPdf={handleInlinePdfUpload}
              onUploadVideo={handleInlineVideoUpload}
              onEditorChange={scheduleAutosave}
              onRenameLesson={handleRenameLesson}
              onInsertBlock={handleInsertBlock}
              t={t}
            />
          </div>
        ) : null}
        {activeTab === "activity" ? (
          <StudentActivityPanel
            courseId={curriculum.course.id}
            totalLessons={curriculum.sections.reduce((count, section) => count + safeLessons(section.lessons).length, 0)}
            t={t}
          />
        ) : null}
        {activeTab === "requests" ? (
          <EnrollmentRequestsPanel
            courseId={curriculum.course.id}
            onPendingCountChange={setPendingRequestsCount}
            t={t}
          />
        ) : null}
      </main>
      {renderProfileModal()}
    </>
  );
}

function insertEditorBlock(editor: EditorJS, type: string, data: Record<string, unknown>) {
  console.log("[course-builder] blocks.insert", type, data);
  return editor.blocks.insert(type, data, undefined, undefined, true);
}

async function replaceEditorBlockDataAndRender(
  editor: EditorJS,
  blockId: string,
  data: Record<string, unknown>
) {
  const content = (await editor.save()) as unknown as EditorContent;
  const blocks = content.blocks.map((block) => {
    if (String(block.id || "") !== blockId) return block;

    return {
      ...block,
      data
    };
  });

  await editor.blocks.render({
    ...content,
    blocks
  } as never);
}

function revealInsertedBlock(addDebug: (message: string) => void, textHint?: string) {
  window.setTimeout(() => {
    const block = findVisibleEditorBlock(textHint);
    if (!block) {
      addDebug(`block dom: not found text="${textHint ?? ""}"`);
      return;
    }

    block.classList.add("inserted-block-highlight");
    const rect = block.getBoundingClientRect();
    addDebug(
      `block dom: top=${Math.round(rect.top)} height=${Math.round(rect.height)} text="${block.textContent?.trim() ?? ""}"`
    );

    const scrollTarget = Math.max(0, window.scrollY + rect.top - window.innerHeight / 2);
    window.scrollTo({
      top: scrollTarget,
      behavior: "smooth"
    });

    window.setTimeout(() => {
      block.classList.remove("inserted-block-highlight");
    }, 1600);
  }, 80);
}

function findVisibleEditorBlock(textHint?: string): HTMLElement | null {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>(".editor-holder .editor-instance .ce-block"));
  if (blocks.length === 0) return null;

  if (textHint) {
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      if (blocks[index].textContent?.includes(textHint)) {
        return blocks[index];
      }
    }
  }

  return blocks[blocks.length - 1];
}

function countVisibleEditorBlocks(): number {
  return document.querySelectorAll(".editor-holder .editor-instance .ce-block").length;
}

function moveLessonInCurriculum(
  curriculum: CourseCurriculum,
  lessonId: string,
  toSectionId: string,
  beforeLessonId: string | null
): CourseCurriculum | null {
  let movedLesson: Lesson | null = null;

  const sectionsWithoutLesson = curriculum.sections.map((section) => {
    const lessons = safeLessons(section.lessons).filter((lesson) => {
      if (lesson.id === lessonId) {
        movedLesson = {
          ...lesson,
          section_id: toSectionId
        };
        return false;
      }

      return true;
    });

    return {
      ...section,
      lessons
    };
  });

  if (!movedLesson) return null;

  const sections = sectionsWithoutLesson.map((section) => {
    if (section.id !== toSectionId) {
      return section;
    }

    const insertIndex = beforeLessonId
      ? Math.max(0, safeLessons(section.lessons).findIndex((lesson) => lesson.id === beforeLessonId))
      : safeLessons(section.lessons).length;

    const lessons = [...safeLessons(section.lessons)];
    lessons.splice(insertIndex === -1 ? lessons.length : insertIndex, 0, movedLesson as Lesson);

    return {
      ...section,
      lessons: lessons.map((lesson, index) => ({
        ...lesson,
        section_id: section.id,
        position: index + 1
      }))
    };
  });

  return {
    ...curriculum,
    sections
  };
}

function uniqueLessonSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "lesson"}-${Date.now()}`;
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

function formatError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "Failed to add block";
  }

  try {
    const payload = JSON.parse(err.message) as { error?: string };
    return humanizeError(payload.error ?? err.message);
  } catch {
    return humanizeError(err.message);
  }
}

function humanizeError(message: string): string {
  if (message.includes("lessons_position_check")) {
    return "Could not save lesson order";
  }
  if (message.startsWith("pq:")) {
    return "Server rejected the request";
  }

  return message;
}

function normalizeCurriculum(curriculum: CourseCurriculum): CourseCurriculum {
  return {
    ...curriculum,
    sections: Array.isArray(curriculum.sections)
      ? curriculum.sections.map((section) => ({
          ...section,
          lessons: safeLessons(section.lessons)
        }))
      : []
  };
}

function safeLessons(value: unknown): Lesson[] {
  return Array.isArray(value) ? value : [];
}

function uploadVideoWithTus(
  file: File,
  credentials: {
    tus_endpoint: string;
    signature: string;
    expiration_time: number;
    video_id: string;
    library_id: string;
  },
  onProgress: (percentage: number) => void,
  onDebug: (message: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    onDebug(`stream tus start: ${credentials.tus_endpoint}`);
    const upload = new tus.Upload(file, {
      endpoint: credentials.tus_endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        AuthorizationSignature: credentials.signature,
        AuthorizationExpire: String(credentials.expiration_time),
        VideoId: credentials.video_id,
        LibraryId: credentials.library_id
      },
      metadata: {
        filetype: file.type || inferVideoMimeType(file.name),
        title: file.name
      },
      onError: (error) => {
        onDebug(`stream tus failed: ${formatTusError(error)}`);
        reject(new Error(formatTusError(error)));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => {
        onDebug("stream tus success");
        resolve();
      }
    });

    upload.start();
  });
}

function inferVideoMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "mov") return "video/quicktime";
  if (extension === "webm") return "video/webm";
  if (extension === "m4v") return "video/x-m4v";
  return "video/mp4";
}

function formatTusError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "Failed to fetch") {
      return "Failed to reach Bunny TUS upload endpoint. Check browser Network tab/CORS, VPN, ad blocker, or Bunny Stream credentials.";
    }
    return error.message;
  }

  return String(error);
}

async function pollStreamVideoUntilPlayable(
  videoId: string,
  onStatus: (status: StreamVideoStatus) => void
): Promise<StreamVideoStatus | null> {
  while (true) {
    try {
      const status = await getStreamVideoStatus(videoId);
      onStatus(status);

      if (status.failed) {
        throw new Error(`Video processing failed: ${status.status_label}`);
      }
      if (status.playable) {
        return status;
      }
    } catch (err) {
      console.warn("[course-builder] video status polling failed", err);
      return null;
    }

    await sleep(5000);
  }
}

function normalizeProcessingProgress(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) {
    return 1;
  }

  return Math.min(99, Math.max(1, Math.round(progress)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function hasPendingMedia(content: EditorContent): boolean {
  return content.blocks.some((block) => {
    const data = block.data;
    if (!data || typeof data !== "object") {
      return false;
    }

    const mediaState = data as { uploading?: unknown; processing?: unknown };
    return mediaState.uploading === true || mediaState.processing === true;
  });
}

function createClientId(prefix: string): string {
  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
