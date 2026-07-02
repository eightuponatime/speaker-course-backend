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

export type SubmissionStatus = "pending" | "accepted" | "needs_revision";

export type SubmissionAttachment = {
  kind: string;
  name: string;
  url: string;
  mime_type?: string;
  size_bytes?: number;
};

export type LessonSubmission = {
  id: string;
  lesson_id: string;
  course_id: string;
  user_id: string;
  status: SubmissionStatus;
  body: string;
  attachments: SubmissionAttachment[];
  viewed_by_admin_at?: string;
  viewed_by_student_at?: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
  updated_at: string;
};

export type LessonSubmissionComment = {
  id: string;
  submission_id: string;
  author_id: string;
  body: string;
  attachments: SubmissionAttachment[];
  created_at: string;
  author_email: string;
  author_full_name: string;
  author_role: "owner" | "admin" | "member";
};

export type LessonSubmissionSummary = {
  id: string;
  lesson_id: string;
  course_id: string;
  user_id: string;
  status: SubmissionStatus;
  updated_at: string;
  reviewed_at?: string;
  viewed_by_admin_at?: string;
  viewed_by_student_at?: string;
  is_unread_for_admin: boolean;
  comment_count: number;
};

export type AdminLessonSubmissionListItem = LessonSubmissionSummary & {
  lesson_title: string;
  section_title: string;
  user_email: string;
  user_full_name: string;
  body_preview: string;
  attachment_count: number;
};

export type LessonSubmissionDetail = {
  submission: LessonSubmission;
  comments: LessonSubmissionComment[];
};

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "admin" | "member";
  auth_provider?: "password" | "google" | "google_password";
  can_change_email?: boolean;
  can_change_password?: boolean;
  created_at?: string;
};

export type AdminUserWithEnrollment = {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  auth_provider: "password" | "google" | "google_password";
  enrollment_id?: string;
  enrollment_status?: EnrollmentStatus;
  enrollment_requested_at?: string;
  enrollment_reviewed_at?: string;
};

export type InvitationCodeStatus = "active" | "used" | "expired";

export type CourseInvitationCode = {
  id: string;
  course_id: string;
  code: string;
  status: InvitationCodeStatus;
  created_by?: string;
  used_by?: string;
  created_at: string;
  expires_at: string;
  used_at?: string;
};
