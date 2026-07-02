import { request } from "./http";
import * as tus from "tus-js-client";
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

export async function uploadUserStorageAsset(input: UploadStorageAssetInput): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("kind", input.kind);

  if (input.courseId) {
    formData.append("course_id", input.courseId);
  }
  if (input.lessonId) {
    formData.append("lesson_id", input.lessonId);
  }

  return request<MediaAsset>("/media/storage", {
    method: "POST",
    body: formData
  });
}

export async function uploadUserSubmissionAsset(input: UploadStorageAssetInput & {
  onProgress?: (progress: number) => void;
}): Promise<MediaAsset> {
  if (input.file.type.startsWith("video/")) {
    const credentials = await createUserStreamUpload(input.file.name);
    await uploadVideoWithTus(input.file, credentials, input.onProgress ?? (() => undefined));
    return completeUserStreamUpload({
      courseId: input.courseId,
      lessonId: input.lessonId,
      videoId: credentials.video_id,
      title: input.file.name,
      sizeBytes: input.file.size
    });
  }

  return uploadUserStorageAsset({
    ...input,
    kind: input.file.type.startsWith("image/") ? "image" : "file"
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

export async function createUserStreamUpload(title: string): Promise<StreamUploadCredentials> {
  return request<StreamUploadCredentials>("/media/stream/tus", {
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

export async function completeUserStreamUpload(input: CompleteStreamUploadInput): Promise<MediaAsset> {
  return request<MediaAsset>("/media/stream/complete", {
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

function uploadVideoWithTus(
  file: File,
  credentials: StreamUploadCredentials,
  onProgress: (percentage: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: credentials.tus_endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        AuthorizationSignature: credentials.signature,
        AuthorizationExpire: String(credentials.expiration_time),
        VideoId: credentials.video_id,
        LibraryId: credentials.library_id
      },
      metadata: {
        filetype: file.type || inferVideoMimeType(file.name),
        title: file.name
      },
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve()
    });

    upload.start();
  });
}

function inferVideoMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "mov") return "video/quicktime";
  if (extension === "webm") return "video/webm";
  if (extension === "m4v") return "video/x-m4v";
  return "video/mp4";
}
