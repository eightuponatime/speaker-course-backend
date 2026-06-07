import { Pencil } from "lucide-react";
import EditorJS from "@editorjs/editorjs";
import { useEffect, useState } from "react";

import type { Lesson } from "../entities/course/course";
import type { TranslationKey } from "../i18n";
import { BlockToolbar, type BlockType } from "./BlockToolbar";
import { LessonEditor } from "./LessonEditor";

type LessonWorkspaceProps = {
  lesson?: Lesson;
  onEditorReady: (editor: EditorJS | null) => void;
  onDebug: (message: string) => void;
  onUploadImage: (file: File) => Promise<{ url: string; caption?: string }>;
  onUploadPdf: (file: File) => Promise<{ url: string; name: string; sizeBytes?: number }>;
  onUploadVideo: (
    file: File,
    onState: (state: { phase: "uploading" | "processing"; progress: number; label: string }) => void
  ) => Promise<{ url: string; name: string }>;
  onEditorChange: () => void;
  onRenameLesson: (lessonId: string, title: string) => Promise<void>;
  onInsertBlock: (blockType: BlockType) => void;
  t: (key: TranslationKey) => string;
};

export function LessonWorkspace({
  lesson,
  onEditorReady,
  onDebug,
  onUploadImage,
  onUploadPdf,
  onUploadVideo,
  onEditorChange,
  onRenameLesson,
  onInsertBlock,
  t
}: LessonWorkspaceProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lesson?.title ?? "");

  useEffect(() => {
    setTitleDraft(lesson?.title ?? "");
    setIsEditingTitle(false);
  }, [lesson?.id, lesson?.title]);

  async function saveTitle() {
    if (!lesson) return;

    const title = titleDraft.trim();
    if (!title || title === lesson.title) {
      setTitleDraft(lesson.title);
      setIsEditingTitle(false);
      return;
    }

    await onRenameLesson(lesson.id, title);
    setIsEditingTitle(false);
  }

  return (
    <section className="lesson-workspace">
      <div className="lesson-content">
        <header className="lesson-title-row">
          {isEditingTitle && lesson ? (
            <input
              autoFocus
              className="lesson-title-input"
              onBlur={() => {
                void saveTitle();
              }}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setTitleDraft(lesson.title);
                  setIsEditingTitle(false);
                }
              }}
              value={titleDraft}
            />
          ) : (
            <h1>{lesson?.title ?? t("selectLesson")}</h1>
          )}
          {lesson && (
            <button onClick={() => setIsEditingTitle(true)} type="button" title="Edit title">
              <Pencil size={17} />
            </button>
          )}
        </header>

        {lesson && (
          <>
            <LessonEditor
              lesson={lesson}
              onReady={onEditorReady}
              onDebug={onDebug}
              onUploadImage={onUploadImage}
              onUploadPdf={onUploadPdf}
              onUploadVideo={onUploadVideo}
              onChange={onEditorChange}
            />
          </>
        )}
      </div>

      <BlockToolbar
        disabled={!lesson}
        t={t}
        onInsert={onInsertBlock}
      />
    </section>
  );
}
