import type {
  Course,
  CourseCurriculum,
  CourseEnrollment,
  CourseSection,
  EditorContent,
  EnrollmentStatus,
  LessonQuizResponse,
  LessonQuizResponseWithUser,
  Lesson
} from "../entities/course/course";
import { request } from "./http";

export function getCourseCurriculum(courseId: string): Promise<CourseCurriculum> {
  return request<CourseCurriculum>(`/admin/courses/${courseId}/curriculum`);
}

export function getAuthenticatedCourseCurriculum(courseId: string): Promise<CourseCurriculum> {
  return request<CourseCurriculum>(`/courses/${courseId}/curriculum`);
}

export function getMyCourseEnrollment(courseId: string): Promise<CourseEnrollment | null> {
  return request<CourseEnrollment | null>(`/courses/${courseId}/enrollment/me`);
}

export function requestCourseEnrollment(courseId: string): Promise<CourseEnrollment> {
  return request<CourseEnrollment>(`/courses/${courseId}/enrollments`, {
    method: "POST"
  });
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
