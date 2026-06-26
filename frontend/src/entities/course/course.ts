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
  access?: CourseAccessWindow;
};

export type CourseAccessWindow = {
  course_id: string;
  user_id: string;
  first_access_at?: string;
  access_expires_at?: string;
  is_expired: boolean;
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

export type CourseStudentActivity = {
  course_id: string;
  user_id: string;
  current_lesson_id?: string;
  last_seen_at?: string;
  online_until?: string;
  is_online: boolean;
  first_access_at?: string;
  access_expires_at?: string;
  is_access_expired: boolean;
  created_at: string;
  updated_at: string;
  user_email: string;
  user_full_name?: string;
  current_lesson_title?: string;
  current_section_id?: string;
  current_section_title?: string;
  last_login_at?: string;
  viewed_lessons: number;
  total_lessons: number;
};

export type LessonProgressHistoryItem = {
  lesson_id: string;
  lesson_title: string;
  lesson_position: number;
  section_id: string;
  section_title: string;
  section_position: number;
  first_viewed_at?: string;
  last_attention_at?: string;
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
  auth_provider?: "password" | "google" | "google_password";
  can_change_email?: boolean;
  can_change_password?: boolean;
  created_at?: string;
};
