import { ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { CourseCurriculum } from "../entities/course/course";
import type { TranslationKey } from "../i18n";
import { DragHandle } from "./DragHandle";

type CurriculumSidebarProps = {
  curriculum: CourseCurriculum;
  activeLessonId: string;
  onSelectLesson: (lessonId: string) => void;
  onAddSection: () => void;
  onAddLesson: (sectionId: string) => void;
  onMoveLesson: (lessonId: string, toSectionId: string, beforeLessonId: string | null) => void;
  onRenameSection: (sectionId: string, title: string) => Promise<void>;
  onDeleteSection: (sectionId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  t: (key: TranslationKey) => string;
};

export function CurriculumSidebar({
  curriculum,
  activeLessonId,
  onSelectLesson,
  onAddSection,
  onAddLesson,
  onMoveLesson,
  onRenameSection,
  onDeleteSection,
  onDeleteLesson,
  t
}: CurriculumSidebarProps) {
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(() => new Set());
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTitleDraft, setSectionTitleDraft] = useState("");

  function handleDrop(toSectionId: string, beforeLessonId: string | null) {
    if (!draggedLessonId) return;

    onMoveLesson(draggedLessonId, toSectionId, beforeLessonId);
    setDraggedLessonId(null);
    setDropTarget(null);
  }

  function toggleSection(sectionId: string) {
    setCollapsedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }

      return next;
    });
  }

  async function saveSectionTitle(sectionId: string, fallbackTitle: string) {
    const nextTitle = sectionTitleDraft.trim();
    setEditingSectionId(null);

    if (!nextTitle || nextTitle === fallbackTitle) {
      setSectionTitleDraft("");
      return;
    }

    await onRenameSection(sectionId, nextTitle);
    setSectionTitleDraft("");
  }

  return (
    <aside className="curriculum-sidebar">
      {curriculum.sections.map((section) => {
        const isCollapsed = collapsedSectionIds.has(section.id);
        const lessons = Array.isArray(section.lessons) ? section.lessons : [];

        return (
        <section className="section-card" key={section.id}>
          <header className="section-header">
            <DragHandle />
            {editingSectionId === section.id ? (
              <input
                className="section-title-input"
                autoFocus
                value={sectionTitleDraft}
                onBlur={() => void saveSectionTitle(section.id, section.title)}
                onChange={(event) => setSectionTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveSectionTitle(section.id, section.title);
                  }
                  if (event.key === "Escape") {
                    setEditingSectionId(null);
                    setSectionTitleDraft("");
                  }
                }}
              />
            ) : (
              <button
                className="section-title-button"
                type="button"
                onClick={() => {
                  setEditingSectionId(section.id);
                  setSectionTitleDraft(section.title);
                }}
              >
                {section.title}
              </button>
            )}
            <button className="section-toggle" onClick={() => toggleSection(section.id)} type="button">
              <ChevronUp className={isCollapsed ? "section-chevron collapsed" : "section-chevron"} size={18} strokeWidth={1.8} />
            </button>
            <button
              className="section-delete"
              onClick={() => onDeleteSection(section.id)}
              type="button"
              aria-label={`Удалить раздел ${section.title}`}
            >
              <Trash2 size={16} strokeWidth={1.9} />
            </button>
          </header>

          {!isCollapsed && <div
            className={`lesson-list ${dropTarget === `${section.id}:end` ? "drop-target" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(`${section.id}:end`);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropTarget(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(section.id, null);
            }}
          >
            {lessons.map((lesson) => (
              <div
                className={[
                  "lesson-item",
                  lesson.id === activeLessonId ? "active" : "",
                  lesson.id === draggedLessonId ? "dragging" : "",
                  dropTarget === lesson.id ? "drop-target" : ""
                ].join(" ")}
                draggable
                key={lesson.id}
                onDragEnd={() => {
                  setDraggedLessonId(null);
                  setDropTarget(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDropTarget(lesson.id);
                }}
                onDragLeave={() => {
                  setDropTarget(null);
                }}
                onDragStart={(event) => {
                  setDraggedLessonId(lesson.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", lesson.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleDrop(section.id, lesson.id);
                }}
                onClick={() => onSelectLesson(lesson.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectLesson(lesson.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <DragHandle />
                <span>{lesson.title}</span>
                <button
                  className="lesson-delete"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteLesson(lesson.id);
                  }}
                  aria-label={`Удалить урок ${lesson.title}`}
                >
                  <Trash2 size={15} strokeWidth={1.9} />
                </button>
              </div>
            ))}
          </div>}

          {!isCollapsed && <button className="add-lesson-button" onClick={() => onAddLesson(section.id)} type="button">
            <Plus size={20} strokeWidth={1.8} />
            <span>{t("addLesson")}</span>
          </button>}
        </section>
      )})}
      <button className="add-section-button" onClick={onAddSection} type="button">
        <Plus size={20} strokeWidth={1.8} />
        <span>{t("addSection")}</span>
      </button>
    </aside>
  );
}
