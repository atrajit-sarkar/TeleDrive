"use client";

import type { MediaItem } from "@/lib/types";
import { MediaItemCard } from "./MediaItemCard";
import { FileSearch } from "lucide-react";

interface MediaGridProps {
  items: MediaItem[];
  onPreview: (item: MediaItem) => void;
}

export function MediaGrid({ items, onPreview }: MediaGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground border-2 border-dashed border-border rounded-lg">
        <FileSearch className="h-16 w-16 mb-4" />
        <h3 className="text-xl font-semibold">No Media Found</h3>
        <p className="text-sm">Try adjusting your search or sort criteria, or upload new media.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-1">
      {items.map((item) => (
        <MediaItemCard key={item.id} item={item} onPreview={onPreview} />
      ))}
    </div>
  );
}
