import type {
  Course,
  CourseAccessWindow,
  AdminUserWithEnrollment,
  CourseInvitationCode,
  CourseCurriculum,
  CourseEnrollment,
  CourseStudentActivity,
  CourseSection,
  EditorContent,
  EnrollmentStatus,
  LessonProgressHistoryItem,
  LessonQuizResponse,
  LessonQuizResponseWithUser,
  Lesson,
  User
} from "../entities/course/course";
import { apiBaseUrl, request } from "./http";

export function getCourseCurriculum(courseId: string): Promise<CourseCurriculum> {
  return request<CourseCurriculum>(`/admin/courses/${courseId}/curriculum`);
}

export function getAdminPrimaryCourseCurriculum(): Promise<CourseCurriculum> {
  return request<CourseCurriculum>("/admin/course/curriculum");
}

export function getAuthenticatedCourseCurriculum(courseId: string): Promise<CourseCurriculum> {
  return request<CourseCurriculum>(`/courses/${courseId}/curriculum`);
}

export function getPrimaryCourseCurriculum(): Promise<CourseCurriculum> {
  return request<CourseCurriculum>("/course/curriculum");
}

export function getMyCourseEnrollment(courseId: string): Promise<CourseEnrollment | null> {
  return request<CourseEnrollment | null>(`/courses/${courseId}/enrollment/me`);
}

export function getMyPrimaryCourseEnrollment(): Promise<CourseEnrollment | null> {
  return request<CourseEnrollment | null>("/course/enrollment/me");
}

export function requestCourseEnrollment(courseId: string): Promise<CourseEnrollment> {
  return request<CourseEnrollment>(`/courses/${courseId}/enrollments`, {
    method: "POST"
  });
}

export function requestPrimaryCourseEnrollment(): Promise<CourseEnrollment> {
  return request<CourseEnrollment>("/course/enrollments", {
    method: "POST"
  });
}

export function trackCourseActivity(input: { courseId: string; lessonId: string }): Promise<CourseStudentActivity> {
  return request<CourseStudentActivity>(`/courses/${input.courseId}/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      lesson_id: input.lessonId
    })
  });
}

export function markCourseActivityOffline(courseId: string): Promise<void> {
  return request<void>(`/courses/${courseId}/activity/offline`, {
    method: "POST"
  });
}

export function markCourseActivityOfflineKeepalive(courseId: string): void {
  void fetch(`${apiBaseUrl}/courses/${courseId}/activity/offline`, {
    method: "POST",
    credentials: "include",
    keepalive: true
  }).catch(() => undefined);
}

export function listMyLessonQuizResponses(lessonId: string): Promise<LessonQuizResponse[]> {
  return request<LessonQuizResponse[]>(`/lessons/${lessonId}/quiz-responses`);
}

export function saveMyLessonQuizResponse(input: {
  lessonId: string;
  quizId: string;
  selectedOptionIndex: number;
}): Promise<LessonQuizResponse> {
  return request<LessonQuizResponse>(`/lessons/${input.lessonId}/quiz-responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      quiz_id: input.quizId,
      selected_option_index: input.selectedOptionIndex
    })
  });
}

export function listLessonQuizResponses(lessonId: string): Promise<LessonQuizResponseWithUser[]> {
  return request<LessonQuizResponseWithUser[]>(`/admin/lessons/${lessonId}/quiz-responses`);
}

export function getCourseBySlug(slug: string): Promise<Course> {
  return request<Course>(`/courses/${slug}`);
}

export function getPrimaryCourse(): Promise<Course> {
  return request<Course>("/course");
}

export type CourseProgramSection = {
  id: string;
  title: string;
  position: number;
};

export type CourseProgram = {
  course_id: string;
  title: string;
  slug: string;
  sections: CourseProgramSection[];
  lessons: number;
  published: boolean;
};

export function getCourseProgramBySlug(slug: string): Promise<CourseProgram> {
  return request<CourseProgram>(`/courses/${slug}/program`);
}

export function getPrimaryCourseProgram(): Promise<CourseProgram> {
  return request<CourseProgram>("/course/program");
}

export function updateCourse(input: { courseId: string; title: string; description: string }): Promise<Course> {
  return request<Course>(`/admin/courses/${input.courseId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: input.title,
      description: input.description
    })
  });
}

export function saveLessonDraft(lessonId: string, content: EditorContent): Promise<Lesson> {
  return request<Lesson>(`/admin/lessons/${lessonId}/draft`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content })
  });
}

export function updateLesson(input: { lessonId: string; title: string; slug: string }): Promise<Lesson> {
  return request<Lesson>(`/admin/lessons/${input.lessonId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: input.title,
      slug: input.slug
    })
  });
}

export function createSection(input: { courseId: string; title: string; position: number }): Promise<CourseSection> {
  return request<CourseSection>(`/admin/courses/${input.courseId}/sections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: input.title,
      position: input.position
    })
  });
}

export function updateSection(input: { courseId: string; sectionId: string; title: string }): Promise<CourseSection> {
  return request<CourseSection>(`/admin/courses/${input.courseId}/sections/${input.sectionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: input.title
    })
  });
}

export function deleteSection(input: { courseId: string; sectionId: string }): Promise<void> {
  return request<void>(`/admin/courses/${input.courseId}/sections/${input.sectionId}`, {
    method: "DELETE"
  });
}

export function createLesson(input: {
  courseId: string;
  sectionId: string;
  title: string;
  slug: string;
  position: number;
}): Promise<Lesson> {
  return request<Lesson>(`/admin/courses/${input.courseId}/sections/${input.sectionId}/lessons`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: input.title,
      slug: input.slug,
      position: input.position
    })
  });
}

export function deleteLesson(lessonId: string): Promise<void> {
  return request<void>(`/admin/lessons/${lessonId}`, {
    method: "DELETE"
  });
}

export function reorderLessons(
  courseId: string,
  lessons: Array<{ id: string; section_id: string; position: number }>
): Promise<CourseCurriculum> {
  return request<CourseCurriculum>(`/admin/courses/${courseId}/lessons/reorder`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ lessons })
  });
}

export function publishLesson(lessonId: string): Promise<Lesson> {
  return request<Lesson>(`/admin/lessons/${lessonId}/publish`, {
    method: "POST"
  });
}

export function publishCourse(courseId: string): Promise<Course> {
  return request<Course>(`/admin/courses/${courseId}/publish`, {
    method: "POST"
  });
}

export function listCourseEnrollments(courseId: string, status: EnrollmentStatus): Promise<CourseEnrollment[]> {
  return request<CourseEnrollment[]>(`/admin/courses/${courseId}/enrollments?status=${status}`);
}

export function listInvitationCodes(courseId: string): Promise<CourseInvitationCode[]> {
  return request<CourseInvitationCode[]>(`/admin/courses/${courseId}/invitation-codes`);
}

export function generateInvitationCode(courseId: string): Promise<CourseInvitationCode> {
  return request<CourseInvitationCode>(`/admin/courses/${courseId}/invitation-codes`, {
    method: "POST"
  });
}

export function listCourseStudentActivity(courseId: string): Promise<CourseStudentActivity[]> {
  return request<CourseStudentActivity[]>(`/admin/courses/${courseId}/student-activity`);
}

export function listStudentLessonHistory(input: {
  courseId: string;
  userId: string;
}): Promise<LessonProgressHistoryItem[]> {
  return request<LessonProgressHistoryItem[]>(
    `/admin/courses/${input.courseId}/students/${input.userId}/lesson-history`
  );
}

export function extendStudentCourseAccess(input: {
  courseId: string;
  userId: string;
  accessExpiresAt: string;
}): Promise<CourseAccessWindow> {
  return request<CourseAccessWindow>(`/admin/courses/${input.courseId}/students/${input.userId}/access`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      access_expires_at: input.accessExpiresAt
    })
  });
}

export function reviewEnrollment(input: {
  enrollmentId: string;
  status: Exclude<EnrollmentStatus, "pending">;
  adminNote?: string;
}): Promise<CourseEnrollment> {
  return request<CourseEnrollment>(`/admin/enrollments/${input.enrollmentId}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status: input.status,
      admin_note: input.adminNote || null
    })
  });
}

export function listAdminCourseUsers(input: {
  courseId: string;
  search?: string;
  role?: "" | "owner" | "admin" | "member";
  enrollmentStatus?: "" | "none" | EnrollmentStatus;
}): Promise<AdminUserWithEnrollment[]> {
  const params = new URLSearchParams();
  if (input.search) params.set("search", input.search);
  if (input.role) params.set("role", input.role);
  if (input.enrollmentStatus) params.set("enrollment_status", input.enrollmentStatus);

  const suffix = params.toString();
  return request<AdminUserWithEnrollment[]>(
    `/admin/courses/${input.courseId}/users${suffix ? `?${suffix}` : ""}`
  );
}

export function updateAdminCourseUserRole(input: {
  courseId: string;
  userId: string;
  role: "owner" | "admin" | "member";
}): Promise<User> {
  return request<User>(`/admin/courses/${input.courseId}/users/${input.userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ role: input.role })
  });
}
