
export type FileType = "image" | "video" | "audio" | "document" | "archive" | "other";

export interface MediaItem {
  id: string;
  name: string;
  type: FileType;
  url: string; // Mock URL for preview/download
  thumbnailUrl: string; // Mock thumbnail URL
  timestamp: number; // Unix timestamp
  tags: string[];
  size?: string; // e.g., "1.2 MB"
  uploadedBy?: string; // User who uploaded
}

export interface UploadFormData {
  file: FileList;
  fileName: string;
  tags: string;
}
