export type MediaAssetKind = "image" | "video" | "pdf" | "file";

export type MediaAsset = {
  id: string;
  owner_id: string;
  course_id?: string;
  lesson_id?: string;
  kind: MediaAssetKind;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  public_url: string;
  created_at: string;
};

export type StreamUploadCredentials = {
  video_id: string;
  library_id: string;
  expiration_time: number;
  signature: string;
  tus_endpoint: string;
  embed_url: string;
};

export type StreamVideoStatus = {
  video_id: string;
  status: number;
  status_label: string;
  encode_progress: number;
  playable: boolean;
  failed: boolean;
  embed_url: string;
  available_quality?: string;
};
