"use client";

import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { UserNav } from "./UserNav";
import { UploadCloud } from "lucide-react";
import type { SearchBarAndControlsProps } from "./SearchBarAndControls"; // Import types
import dynamic from 'next/dynamic';

const SearchBarAndControls = dynamic(() => 
  import('./SearchBarAndControls').then(mod => mod.SearchBarAndControls),
  { ssr: false, loading: () => <div className="h-11 w-full bg-muted rounded-md animate-pulse md:max-w-lg"></div> }
);


interface AppHeaderProps extends SearchBarAndControlsProps {
  onUploadClick: () => void;
}

export function AppHeader({ onUploadClick, onSearch, onSortChange, initialSortKey, initialSortOrder }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 items-center justify-between gap-4 max-w-screen-2xl px-4 md:px-8">
        <div className="hidden md:flex">
         <Logo />
        </div>
        
        <div className="flex-1 md:px-8">
          <SearchBarAndControls 
            onSearch={onSearch} 
            onSortChange={onSortChange}
            initialSortKey={initialSortKey}
            initialSortOrder={initialSortOrder}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={onUploadClick} 
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            aria-label="Upload media"
          >
            <UploadCloud className="h-5 w-5 md:mr-2" />
            <span className="hidden md:inline">Upload</span>
          </Button>
          <UserNav />
        </div>
      </div>
    </header>
  );
}
