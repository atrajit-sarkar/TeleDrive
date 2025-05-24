
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { MediaItem, UploadFormData, User } from "@/lib/types";
import { AppHeader } from "@/components/teledrive/AppHeader";
import { MediaGrid } from "@/components/teledrive/MediaGrid";
import { UploadDialog } from "@/components/teledrive/UploadDialog";
import { PreviewDialog } from "@/components/teledrive/PreviewDialog";
import { fetchInitialMediaItems, performAiSearch, uploadFileAction, checkAuthStatus } from "@/app/actions";
import type { SortKey, SortOrder } from "@/components/teledrive/SearchBarAndControls";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export default function TeleDrivePage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [allMediaItems, setAllMediaItems] = useState<MediaItem[]>([]);
  const [displayedMediaItems, setDisplayedMediaItems] = useState<MediaItem[]>([]);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);
  
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    const verifyAuthAndLoadData = async () => {
      setIsAuthLoading(true);
      const authData = await checkAuthStatus();
      if (!authData.loggedIn) {
        toast({ title: "Not Authenticated", description: "Redirecting to login.", variant: "destructive" });
        router.push("/login");
        return;
      }
      setCurrentUser(authData.user || null);
      setIsAuthLoading(false);

      // If authenticated, load media
      setIsMediaLoading(true);
      try {
        const items = await fetchInitialMediaItems();
        setAllMediaItems(items);
        setDisplayedMediaItems(items);
      } catch (error) {
        console.error("Failed to fetch initial media items:", error);
        toast({
          title: "Error Loading Media",
          description: "Could not load media items. Please try again later.",
          variant: "destructive",
        });
        setAllMediaItems([]);
        setDisplayedMediaItems([]);
      } finally {
        setIsMediaLoading(false);
      }
    };
    verifyAuthAndLoadData();
  }, [router, toast]);

  const handleSearch = useCallback(async (searchTerm: string) => {
    setIsMediaLoading(true); // Use media loading state for search as well
    try {
      const results = await performAiSearch(searchTerm, allMediaItems);
      setDisplayedMediaItems(results);
    } catch (error) {
      console.error("Search failed:", error);
      toast({ title: "Search Error", description: "Could not perform search.", variant: "destructive" });
      setDisplayedMediaItems(searchTerm ? [] : allMediaItems);
    } finally {
      setIsMediaLoading(false);
    }
  }, [allMediaItems, toast]);

  const handleSortChange = useCallback((newSortKey: SortKey, newSortOrder: SortOrder) => {
    setSortKey(newSortKey);
    setSortOrder(newSortOrder);
  }, []);

  const sortedMediaItems = useMemo(() => {
    return [...displayedMediaItems].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "date") {
        comparison = (b.timestamp || 0) - (a.timestamp || 0); 
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
    // Your backend app.py expects 'caption' for file name and tags.
    // Let's pass fileName as part of caption.
    let caption = data.fileName;
    if (data.tags) {
      caption += `\nTags: ${data.tags}`;
    }
    formData.append('fileName', data.fileName); // Keep for potential use or if backend changes
    formData.append('tags', data.tags || ''); // Keep for potential use

    // If your backend specifically needs 'caption' in form data for the combined name+tags:
    // formData.append('caption', caption);


    try {
      const result = await uploadFileAction(formData);
      if (result.success && result.newItem) {
        setAllMediaItems(prevItems => [result.newItem!, ...prevItems].sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0) ));
        setDisplayedMediaItems(prevItems => [result.newItem!, ...prevItems].sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0) ));
        toast({ title: "Upload Successful", description: result.message });
      } else {
        toast({ title: "Upload Failed", description: result.message || "Unknown error", variant: "destructive" });
      }
    } catch (error) {
       toast({ title: "Upload Error", description: "An unexpected error occurred during upload.", variant: "destructive" });
    }
  }, [toast]);

  const handlePreview = useCallback((item: MediaItem) => {
    setSelectedMediaItem(item);
    setIsPreviewDialogOpen(true);
  }, []);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Checking authentication...</p>
      </div>
    );
  }
  
  if (!currentUser && !isAuthLoading) {
     // This case should ideally be handled by the redirect in useEffect,
     // but as a fallback or if the redirect hasn't happened yet.
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

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
        {isMediaLoading ? (
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
