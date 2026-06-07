export type Lesson = {
  id: string;
  course_id: string;
  section_id: string;
  title: string;
  slug: string;
  position: number;
  status: "draft" | "published" | "archived";
  draft_content: EditorContent;
};

export type EditorContent = {
  time?: number;
  blocks: Array<Record<string, unknown>>;
  version?: string;
};

export type CourseSection = {
  id: string;
  course_id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: "draft" | "published" | "archived";
};

export type CourseCurriculum = {
  course: Course;
  sections: CourseSection[];
  has_unpublished_changes: boolean;
};

export type EnrollmentStatus = "pending" | "approved" | "rejected" | "revoked";

export type CourseEnrollment = {
  id: string;
  course_id: string;
  user_id: string;
  status: EnrollmentStatus;
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  admin_note?: string;
  user_email?: string;
  user_full_name?: string;
};

export type LessonQuizResponse = {
  id: string;
  lesson_id: string;
  user_id: string;
  quiz_id: string;
  selected_option_index: number;
  created_at: string;
  updated_at: string;
};

export type LessonQuizResponseWithUser = LessonQuizResponse & {
  user_email: string;
  user_full_name?: string;
};

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "member";
};
