
"use server";

import type { 
  MediaItem,
  AuthStatusResponse,
  LoginStartResponse,
  LoginVerifyResponse,
  FetchMediaResponse,
  UploadFileBackendResponse,
  User
} from "@/lib/types";
import { revalidatePath } from "next/cache";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://localhost:5000"; // Your Python backend URL

// --- Authentication Actions ---

export async function startLogin(phone: string): Promise<LoginStartResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/send_code_request`, { // Matches your app.py route
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone }), // Matches your app.py expected key
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to send code. Server returned an error." }));
      return { error: errorData.error || `Server error: ${response.status}` };
    }
    return await response.json();
  } catch (error) {
    console.error("Start login error:", error);
    return { error: "An unexpected error occurred during login start." };
  }
}

export async function verifyLogin(code: string): Promise<LoginVerifyResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/sign_in`, { // Matches your app.py route
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }), // Assumes phone_number is in session on backend
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Login verification failed. Server returned an error." }));
      return { error: errorData.error || `Server error: ${response.status}` };
    }
    return await response.json();
  } catch (error) {
    console.error("Verify login error:", error);
    return { error: "An unexpected error occurred during login verification." };
  }
}

export async function checkAuthStatus(): Promise<AuthStatusResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/is_authenticated`, { cache: 'no-store' }); // Matches your app.py route
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to check auth status. Server returned an error." }));
        return { loggedIn: false, error: errorData.error || `Server error: ${response.status}` };
    }
    return await response.json();
  } catch (error) {
    console.error("Check auth status error:", error);
    return { loggedIn: false, error: "An unexpected error occurred while checking auth status." };
  }
}

export async function logoutUser(): Promise<{ message?: string; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/logout`, { method: 'POST' }); // Matches your app.py route
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Logout failed. Server returned an error." }));
      return { error: errorData.error || `Server error: ${response.status}` };
    }
    return await response.json();
  } catch (error) {
    console.error("Logout error:", error);
    return { error: "An unexpected error occurred during logout." };
  }
}

// --- Media Actions ---

export async function fetchInitialMediaItems(): Promise<MediaItem[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/get_saved_messages_media`, { cache: 'no-store' }); // Matches your app.py route
    if (!response.ok) {
      const errorData: FetchMediaResponse = await response.json().catch(() => ({ items: [], error: "Failed to fetch media. Server returned an error." }));
      console.error("Fetch media error from backend:", errorData.error);
      return [];
    }
    const data: MediaItem[] = await response.json(); // Your backend returns a list directly
    return data;
  } catch (error) {
    console.error("Fetch initial media items error:", error);
    return [];
  }
}

export async function uploadFileAction(formData: FormData): Promise<UploadFileBackendResponse> {
  // Note: The 'fileName' and 'tags' from original FormData are not directly used here
  // as your backend's /upload_file endpoint might expect them differently (e.g., in request.form)
  // The existing backend app.py /upload_file expects 'file' and 'caption'
  
  // We need to construct a new FormData to match the backend's expectation for field names if different.
  // Your Python backend /upload_file takes 'file' and 'caption' (from request.form.get('caption')).
  // The frontend currently sends 'fileName' and 'tags' as separate FormData entries.
  // We'll keep it simple for now, assuming the backend handles this.
  
  try {
    const response = await fetch(`${BACKEND_URL}/upload_file`, { // Matches your app.py route
      method: 'POST',
      body: formData, // Sending the raw FormData from the client
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ success: false, message: "Upload failed. Server returned an error." }));
      return { success: false, message: errorData.message || `Server error: ${response.status}` };
    }
    const result: UploadFileBackendResponse = await response.json();
    if (result.success) {
        revalidatePath("/"); // Revalidate the main page to show new item
    }
    return result;
  } catch (error) {
    console.error("Upload file action error:", error);
    return { success: false, message: "An unexpected error occurred during upload." };
  }
}


// AI Search - Placeholder, as it's more complex to integrate with backend search
// For now, it will continue to operate on client-side filtered data.
// A true AI search would involve sending keywords to the backend,
// which then uses Genkit or other tools to process and filter Telegram data.
export async function performAiSearch(keywords: string, currentItems: MediaItem[]): Promise<MediaItem[]> {
  if (!keywords.trim()) {
    return currentItems;
  }
  console.log(`AI Search for: "${keywords}". Currently performing simple client-side fallback.`);
  const lowerKeywords = keywords.toLowerCase();
  return currentItems.filter(item => 
    item.name.toLowerCase().includes(lowerKeywords) || 
    (item.tags && item.tags.some(tag => tag.toLowerCase().includes(lowerKeywords)))
  );
}
