"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MediaItem } from "@/lib/types";
import { Download, ExternalLink, Image as ImageIcon, Video as VideoIcon, FileText as DocumentIcon, Info } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";
import { FileIcon } from "./FileIcon";
import { Badge } from "@/components/ui/badge";

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaItem: MediaItem | null;
}

export function PreviewDialog({ open, onOpenChange, mediaItem }: PreviewDialogProps) {
  if (!mediaItem) return null;

  const handleDownload = () => {
    // Mock download
    alert(`Downloading ${mediaItem.name}... (mock)`);
    // In a real app: window.open(mediaItem.url, '_blank');
  };

  const renderPreviewContent = () => {
    switch (mediaItem.type) {
      case "image":
        return (
          <Image
            src={mediaItem.url}
            alt={mediaItem.name}
            width={800}
            height={600}
            className="rounded-md object-contain max-h-[60vh]"
            data-ai-hint="image preview"
          />
        );
      case "video":
        return (
          <div className="bg-black rounded-md flex items-center justify-center max-h-[60vh] aspect-video">
            {/* Replace with actual video player if possible */}
            <VideoIcon className="h-24 w-24 text-muted-foreground" />
            <p className="absolute bottom-4 text-sm text-white bg-black/50 px-2 py-1 rounded">Video preview placeholder</p>
          </div>
        );
      default:
        return (
          <div className="bg-muted rounded-md flex flex-col items-center justify-center h-64 p-8 text-center">
            <FileIcon type={mediaItem.type} className="h-24 w-24 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{mediaItem.name}</p>
            <p className="text-sm text-muted-foreground">Direct preview not available for this file type.</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col shadow-xl">
        <DialogHeader>
          <DialogTitle className="truncate text-xl">{mediaItem.name}</DialogTitle>
          <DialogDescription>
            Uploaded on {format(new Date(mediaItem.timestamp), "PPP p")}
            {mediaItem.size && ` • ${mediaItem.size}`}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow p-1">
          <div className="my-4 flex justify-center">
            {renderPreviewContent()}
          </div>
        
          <div className="mt-6 space-y-3 px-2">
            <div>
              <h4 className="font-semibold mb-1 text-sm">Tags:</h4>
              {mediaItem.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {mediaItem.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tags</p>
              )}
            </div>
             <div>
                <h4 className="font-semibold mb-1 text-sm">File Type:</h4>
                <p className="text-sm text-muted-foreground capitalize flex items-center gap-1.5">
                    <FileIcon type={mediaItem.type} className="h-4 w-4" /> {mediaItem.type}
                </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-auto pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => window.open(mediaItem.url, '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" /> Open Original
          </Button>
          <Button onClick={handleDownload} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Download className="mr-2 h-4 w-4" /> Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
