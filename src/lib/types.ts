
export type FileType = "image" | "video" | "audio" | "document" | "archive" | "other";

export interface MediaItem {
  id: string;
  name: string;
  type: FileType;
  url: string; // Initially from backend (e.g., placehold.co), or direct stream URL
  thumbnailUrl: string; // Initially from backend, or direct stream URL
  timestamp: number; // Unix timestamp in milliseconds
  tags: string[];
  size?: string; // e.g., "1.2 MB"
  uploadedBy?: string; // User who uploaded
  dataAiHint?: string;
}

export interface UploadFormData {
  file: FileList;
  fileName: string;
  tags: string;
}

// API Response Types from Python Backend
export interface User {
  id: number | string;
  firstName?: string;
  username?: string;
}

export interface AuthStatusResponse {
  loggedIn: boolean;
  user?: User;
  error?: string;
}

export interface LoginStartResponse {
  message?: string;
  error?: string;
}

export interface LoginVerifyResponse {
  message?: string;
  user?: User;
  error?: string;
}

export interface FetchMediaResponse {
  items: MediaItem[];
  error?: string;
}

export interface UploadFileBackendResponse {
  success: boolean;
  message: string;
  newItem?: MediaItem;
  error?: string;
}
