"use server";

import { searchMediaItems, type SearchMediaItemsInput, type SearchMediaItemsOutput } from "@/ai/flows/search-media-items";
import { mockMediaItems } from "@/lib/mock-data";
import type { MediaItem } from "@/lib/types";

export async function performAiSearch(keywords: string): Promise<MediaItem[]> {
  if (!keywords.trim()) {
    return mockMediaItems; // Return all items if search is empty
  }

  try {
    // This is where the Genkit flow is called
    const input: SearchMediaItemsInput = { keywords };
    const output: SearchMediaItemsOutput = await searchMediaItems(input);
    
    // The AI flow returns IDs. Filter mockMediaItems based on these IDs.
    // In a real app, these IDs would be used to fetch from a database or Telegram.
    const resultMediaItemIds = new Set(output.searchResults);
    
    // The current AI flow's prompt tells it to return IDs based on analysis.
    // Since the `identifyMediaContent` tool is a placeholder, it might not return valid IDs from mockData.
    // For demonstration, we'll simulate that if the AI returns some IDs, we filter by them.
    // If the AI tool were fully implemented, it would identify items in media and return relevant IDs.
    // For now, if we get any IDs back, let's try to filter. If not, maybe return items whose name/tags match.

    if (resultMediaItemIds.size > 0) {
      const filteredItems = mockMediaItems.filter(item => resultMediaItemIds.has(item.id));
      if (filteredItems.length > 0) {
        return filteredItems;
      }
    }
    
    // Fallback: simple keyword search if AI doesn't yield results or no IDs match
    const lowerKeywords = keywords.toLowerCase();
    return mockMediaItems.filter(item => 
      item.name.toLowerCase().includes(lowerKeywords) || 
      item.tags.some(tag => tag.toLowerCase().includes(lowerKeywords))
    );

  } catch (error) {
    console.error("AI Search Error:", error);
    // Fallback to simple keyword search on error
    const lowerKeywords = keywords.toLowerCase();
    return mockMediaItems.filter(item => 
      item.name.toLowerCase().includes(lowerKeywords) || 
      item.tags.some(tag => tag.toLowerCase().includes(lowerKeywords))
    );
  }
}

// Mock action for uploading a file
export async function uploadFileAction(formData: FormData): Promise<{ success: boolean; message: string; newItem?: MediaItem }> {
  const file = formData.get('file') as File;
  const fileName = formData.get('fileName') as string;
  const tags = (formData.get('tags') as string).split(',').map(tag => tag.trim()).filter(Boolean);

  if (!file || !fileName) {
    return { success: false, message: "File and filename are required." };
  }

  // Simulate upload process
  await new Promise(resolve => setTimeout(resolve, 1000));

  const newItem: MediaItem = {
    id: String(Date.now()), // Simple unique ID
    name: fileName,
    type: determineFileType(file.type),
    url: URL.createObjectURL(file), // Temporary URL for local preview
    thumbnailUrl: "https://placehold.co/200x150.png?text=New+Upload",
    dataAiHint: "new upload",
    timestamp: Date.now(),
    tags: tags,
    size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
  };
  
  // In a real app, you would add this to your data source (e.g., database, or update Telegram)
  // For this mock, we don't modify mockMediaItems directly here as actions should be pure if possible or manage state via a store/db.
  // The client will handle adding this to its local state.

  return { success: true, message: `${fileName} uploaded successfully (mock).`, newItem };
}

function determineFileType(mimeType: string): MediaItem['type'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/') || mimeType.includes('document')) return 'document';
  if (mimeType === 'application/zip' || mimeType.includes('archive')) return 'archive';
  return 'other';
}
