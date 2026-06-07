import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { Course } from "../entities/course/course";
import type { TranslationKey } from "../i18n";

type CourseSettingsPanelProps = {
  course: Course;
  status: string;
  t: (key: TranslationKey) => string;
  onSave: (input: { title: string; description: string }) => Promise<void>;
};

export function CourseSettingsPanel({ course, status, t, onSave }: CourseSettingsPanelProps) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description || "");
  const [saving, setSaving] = useState(false);
  const hasChanges = title.trim() !== course.title || description.trim() !== (course.description || "");

  useEffect(() => {
    setTitle(course.title);
    setDescription(course.description || "");
  }, [course.description, course.title]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hasChanges) return;

    setSaving(true);
    try {
      await onSave({ title, description });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-panel">
      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span>{t("courseTitle")}</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label>
          <span>{t("shortDescription")}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
          />
        </label>

        <div className="settings-actions">
          <button type="submit" disabled={saving || !hasChanges}>
            {saving ? t("saving") : t("saveSettings")}
          </button>
          {status ? <span>{status}</span> : <span>{t("noChanges")}</span>}
        </div>
      </form>
    </section>
  );
}
