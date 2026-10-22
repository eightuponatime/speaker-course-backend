import { apiBaseUrl, request } from "./http";
import * as tus from "tus-js-client";
import type { MediaAsset, MediaAssetKind, StreamUploadCredentials, StreamVideoStatus } from "../entities/media/media";
import { validateVideoFile } from "../utils/videoFileValidation";

type UploadStorageAssetInput = {
  file: File;
  kind: Extract<MediaAssetKind, "image" | "video" | "pdf" | "file">;
  courseId?: string;
  lessonId?: string;
};

type CompleteStreamUploadInput = {
  courseId?: string;
  lessonId?: string;
  videoId: string;
  title: string;
  sizeBytes: number;
  expirationTime: number;
  signature: string;
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
    await validateVideoFile(input.file);
    const credentials = await createUserStreamUpload(input.file.name);
    await uploadVideoWithTus(input.file, credentials, (percent) => input.onProgress?.(Math.min(99, percent)));
    const asset = await completeUserStreamUpload({
      courseId: input.courseId,
      lessonId: input.lessonId,
      videoId: credentials.video_id,
      title: input.file.name,
      sizeBytes: input.file.size,
      expirationTime: credentials.expiration_time,
      signature: credentials.signature
    });
    input.onProgress?.(100);
    return asset;
  }

  return uploadUserStorageAssetWithProgress({
    ...input,
    kind: input.file.type.startsWith("image/") ? "image" : "file"
  }, input.onProgress);
}

export async function createStreamUpload(title: string): Promise<StreamUploadCredentials> {
  const credentials = await request<StreamUploadCredentials>("/admin/media/stream/tus", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title })
  });
  assertStreamCompletionAPI(credentials);
  return credentials;
}

export async function createUserStreamUpload(title: string): Promise<StreamUploadCredentials> {
  const credentials = await request<StreamUploadCredentials>("/media/stream/tus", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title })
  });
  assertStreamCompletionAPI(credentials);
  return credentials;
}

function assertStreamCompletionAPI(credentials: StreamUploadCredentials): void {
  if (credentials.complete_api_version !== 2) {
    throw new Error("Backend использует старую версию API загрузки видео. Перезапустите backend и повторите загрузку файла.");
  }
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
      size_bytes: input.sizeBytes,
      expiration_time: input.expirationTime,
      signature: input.signature
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
      size_bytes: input.sizeBytes,
      expiration_time: input.expirationTime,
      signature: input.signature
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

function uploadUserStorageAssetWithProgress(
  input: UploadStorageAssetInput,
  onProgress?: (progress: number) => void
): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("kind", input.kind);

  if (input.courseId) {
    formData.append("course_id", input.courseId);
  }
  if (input.lessonId) {
    formData.append("lesson_id", input.lessonId);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBaseUrl}/media/storage`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(readUploadError(xhr.responseText) || xhr.statusText));
        return;
      }

      try {
        onProgress?.(100);
        resolve(JSON.parse(xhr.responseText) as MediaAsset);
      } catch (error) {
        reject(error);
      }
    };

    xhr.onerror = () => reject(new Error("Не удалось загрузить файл"));
    xhr.onabort = () => reject(new Error("Загрузка файла отменена"));
    xhr.send(formData);
  });
}

function readUploadError(text: string): string {
  if (!text) return "";

  try {
    const payload = JSON.parse(text) as { error?: unknown; message?: unknown };
    if (typeof payload.error === "string") return payload.error;
    if (typeof payload.message === "string") return payload.message;
  } catch {
    return text;
  }

  return text;
}

function inferVideoMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "mov") return "video/quicktime";
  if (extension === "webm") return "video/webm";
  if (extension === "m4v") return "video/x-m4v";
  return "video/mp4";
}
