import { ChevronUp, Plus } from "lucide-react";
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
  t: (key: TranslationKey) => string;
};

export function CurriculumSidebar({
  curriculum,
  activeLessonId,
  onSelectLesson,
  onAddSection,
  onAddLesson,
  onMoveLesson,
  t
}: CurriculumSidebarProps) {
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(() => new Set());

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

  return (
    <aside className="curriculum-sidebar">
      {curriculum.sections.map((section) => {
        const isCollapsed = collapsedSectionIds.has(section.id);
        const lessons = Array.isArray(section.lessons) ? section.lessons : [];

        return (
        <section className="section-card" key={section.id}>
          <header className="section-header">
            <DragHandle />
            <strong>{section.title}</strong>
            <button className="section-toggle" onClick={() => toggleSection(section.id)} type="button">
              <ChevronUp className={isCollapsed ? "section-chevron collapsed" : "section-chevron"} size={18} strokeWidth={1.8} />
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
              <button
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
                type="button"
              >
                <DragHandle />
                <span>{lesson.title}</span>
              </button>
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
