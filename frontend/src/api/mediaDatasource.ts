import { request } from "./http";
import type { MediaAsset, MediaAssetKind, StreamUploadCredentials, StreamVideoStatus } from "../entities/media/media";

type UploadStorageAssetInput = {
  file: File;
  kind: Extract<MediaAssetKind, "image" | "pdf" | "file">;
  courseId?: string;
  lessonId?: string;
};

type CompleteStreamUploadInput = {
  courseId?: string;
  lessonId?: string;
  videoId: string;
  title: string;
  sizeBytes: number;
};

export async function uploadStorageAsset(input: UploadStorageAssetInput): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("kind", input.kind);

  if (input.courseId) {
    formData.append("course_id", input.courseId);
  }
  if (input.lessonId) {
    formData.append("lesson_id", input.lessonId);
  }

  return request<MediaAsset>("/admin/media/storage", {
    method: "POST",
    body: formData
  });
}

export async function createStreamUpload(title: string): Promise<StreamUploadCredentials> {
  return request<StreamUploadCredentials>("/admin/media/stream/tus", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title })
  });
}

export async function completeStreamUpload(input: CompleteStreamUploadInput): Promise<MediaAsset> {
  return request<MediaAsset>("/admin/media/stream/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      course_id: input.courseId,
      lesson_id: input.lessonId,
      video_id: input.videoId,
      title: input.title,
      size_bytes: input.sizeBytes
    })
  });
}

export async function getStreamVideoStatus(videoId: string): Promise<StreamVideoStatus> {
  return request<StreamVideoStatus>(`/admin/media/stream/videos/${videoId}/status`);
}
