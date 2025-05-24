
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { MediaItem, UploadFormData } from "@/lib/types";
// import { mockMediaItems } from "@/lib/mock-data"; // Will be fetched via action
import { AppHeader } from "@/components/teledrive/AppHeader";
import { MediaGrid } from "@/components/teledrive/MediaGrid";
import { UploadDialog } from "@/components/teledrive/UploadDialog";
import { PreviewDialog } from "@/components/teledrive/PreviewDialog";
import { fetchInitialMediaItems, performAiSearch, uploadFileAction } from "@/app/actions";
import type { SortKey, SortOrder } from "@/components/teledrive/SearchBarAndControls";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeleDrivePage() {
  const [allMediaItems, setAllMediaItems] = useState<MediaItem[]>([]); // Stores all fetched items
  const [displayedMediaItems, setDisplayedMediaItems] = useState<MediaItem[]>([]); // Items to display after search/sort
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const { toast } = useToast();

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        // In a real app, this would fetch from Telegram via your backend
        const items = await fetchInitialMediaItems();
        setAllMediaItems(items);
        setDisplayedMediaItems(items); // Initially display all items
      } catch (error) {
        console.error("Failed to fetch initial media items:", error);
        toast({
          title: "Error Loading Media",
          description: "Could not load media items. Please try again later.",
          variant: "destructive",
        });
        setAllMediaItems([]); // Set to empty on error
        setDisplayedMediaItems([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, [toast]);

  const handleSearch = useCallback(async (searchTerm: string) => {
    setIsLoading(true);
    try {
      // Pass allMediaItems to performAiSearch so it can search within the full dataset
      const results = await performAiSearch(searchTerm, allMediaItems);
      setDisplayedMediaItems(results); // Update displayed items with search results
    } catch (error) {
      console.error("Search failed:", error);
      toast({ title: "Search Error", description: "Could not perform search.", variant: "destructive" });
      setDisplayedMediaItems(searchTerm ? [] : allMediaItems); // Show empty or all on error
    } finally {
      setIsLoading(false);
    }
  }, [allMediaItems, toast]);

  const handleSortChange = useCallback((newSortKey: SortKey, newSortOrder: SortOrder) => {
    setSortKey(newSortKey);
    setSortOrder(newSortOrder);
  }, []);

  const sortedMediaItems = useMemo(() => {
    // Sort only the currently displayed items (e.g., search results or all items)
    return [...displayedMediaItems].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "date") {
        comparison = b.timestamp - a.timestamp; 
      } else if (sortKey === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortKey === "type") {
        comparison = a.type.localeCompare(b.type);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [displayedMediaItems, sortKey, sortOrder]);

  const handleUpload = useCallback(async (data: UploadFormData) => {
    const formData = new FormData();
    formData.append('file', data.file[0]);
    formData.append('fileName', data.fileName);
    formData.append('tags', data.tags || '');
    
    try {
      const result = await uploadFileAction(formData);
      if (result.success && result.newItem) {
        // Add to both allMediaItems and displayedMediaItems
        // This assumes the new item should be immediately visible and part of the base dataset
        setAllMediaItems(prevItems => [result.newItem!, ...prevItems]);
        setDisplayedMediaItems(prevItems => [result.newItem!, ...prevItems]);
        toast({ title: "Upload Successful", description: result.message });
      } else {
        toast({ title: "Upload Failed", description: result.message, variant: "destructive" });
      }
    } catch (error) {
       toast({ title: "Upload Error", description: "An unexpected error occurred.", variant: "destructive" });
    }
  }, [toast]);

  const handlePreview = useCallback((item: MediaItem) => {
    setSelectedMediaItem(item);
    setIsPreviewDialogOpen(true);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader
        onUploadClick={() => setIsUploadDialogOpen(true)}
        onSearch={handleSearch}
        onSortChange={handleSortChange}
        initialSortKey={sortKey}
        initialSortOrder={sortOrder}
      />
      <main className="flex-grow container max-w-screen-2xl mx-auto px-4 md:px-8 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <MediaGrid items={sortedMediaItems} onPreview={handlePreview} />
        )}
      </main>
      <UploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onUpload={handleUpload}
      />
      <PreviewDialog
        open={isPreviewDialogOpen}
        onOpenChange={setIsPreviewDialogOpen}
        mediaItem={selectedMediaItem}
      />
    </div>
  );
}


function CardSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden shadow-md rounded-lg bg-card">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-4 flex-grow">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-3" />
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="p-3 border-t">
        <div className="flex justify-between w-full items-center">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    </div>
  );
}
