export type NotificationType =
  | "course_enrollment_requested"
  | "course_access_approved"
  | "course_access_rejected"
  | "course_access_revoked"
  | "course_access_restored";

export type Notification = {
  id: string;
  user_id: string;
  actor_id?: string;
  course_id?: string;
  enrollment_id?: string;
  type: NotificationType;
  title: string;
  body: string;
  read_at?: string;
  deleted_at?: string;
  created_at: string;
};
