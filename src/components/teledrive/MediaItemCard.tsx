"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { MediaItem } from "@/lib/types";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { FileIcon } from "./FileIcon";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Download, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";

interface MediaItemCardProps {
  item: MediaItem;
  onPreview: (item: MediaItem) => void;
}

export function MediaItemCard({ item, onPreview }: MediaItemCardProps) {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    alert(`Downloading ${item.name}... (mock)`);
  };
  
  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onPreview(item);
  };

  return (
    <Card 
      className="flex flex-col h-full overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer rounded-lg"
      onClick={() => onPreview(item)}
      role="button"
      tabIndex={0}
      aria-label={`Preview ${item.name}`}
    >
      <CardHeader className="p-0 relative aspect-[4/3] overflow-hidden">
        <Image
          src={item.thumbnailUrl}
          alt={item.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          data-ai-hint={item.dataAiHint || item.type}
        />
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/70 hover:bg-background rounded-full">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={handlePreviewClick}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <div className="flex items-start gap-2 mb-1">
          <FileIcon type={item.type} className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <CardTitle className="text-base font-semibold leading-tight line-clamp-2 break-all">
            {item.name}
          </CardTitle>
        </div>
        {item.tags && item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0.5">
                {tag}
              </Badge>
            ))}
            {item.tags.length > 3 && <Badge variant="outline" className="text-xs px-1.5 py-0.5">...</Badge>}
          </div>
        )}
      </CardContent>
      <CardFooter className="p-3 text-xs text-muted-foreground border-t bg-card">
        <div className="flex justify-between w-full items-center">
          <span>{item.size || ""}</span>
          <span>{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
