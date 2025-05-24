"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RotateCcw, ArrowDownUp, CalendarDays, Type, Tags } from "lucide-react";
import React, { useState, useTransition } from "react";
import type { MediaItem } from "@/lib/types";

export type SortKey = "date" | "name" | "type";
export type SortOrder = "asc" | "desc";

interface SearchBarAndControlsProps {
  onSearch: (searchTerm: string) => Promise<void>;
  onSortChange: (sortKey: SortKey, sortOrder: SortOrder) => void;
  initialSortKey?: SortKey;
  initialSortOrder?: SortOrder;
}

export function SearchBarAndControls({ 
  onSearch, 
  onSortChange,
  initialSortKey = "date",
  initialSortOrder = "desc"
}: SearchBarAndControlsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [isPending, startTransition] = useTransition();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await onSearch(searchTerm);
    });
  };

  const handleResetSearch = () => {
    setSearchTerm("");
    startTransition(async () => {
      await onSearch(""); // Empty search to show all items
    });
  };

  const handleSortKeyChange = (value: string) => {
    const newSortKey = value as SortKey;
    setSortKey(newSortKey);
    onSortChange(newSortKey, sortOrder);
  };
  
  const toggleSortOrder = () => {
    const newSortOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(newSortOrder);
    onSortChange(sortKey, newSortOrder);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center w-full">
      <form onSubmit={handleSearchSubmit} className="flex-grow flex gap-2 w-full md:w-auto">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name or tags (AI enhanced)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-16 h-11 text-base" // Increased padding for icons
            aria-label="Search media"
          />
           {searchTerm && (
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={handleResetSearch}
              aria-label="Clear search"
            >
              <RotateCcw className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Button>
          )}
        </div>
        <Button type="submit" className="h-11 px-6 bg-primary hover:bg-primary/90" disabled={isPending}>
          {isPending ? "Searching..." : <Search className="h-5 w-5 md:hidden" />}
          <span className="hidden md:inline">Search</span>
        </Button>
      </form>

      <div className="flex gap-2 items-center w-full md:w-auto">
        <Select value={sortKey} onValueChange={handleSortKeyChange}>
          <SelectTrigger className="w-full md:w-[180px] h-11" aria-label="Sort by">
             <div className="flex items-center gap-2">
                {sortKey === 'date' && <CalendarDays className="h-4 w-4 text-muted-foreground" />}
                {sortKey === 'name' && <Type className="h-4 w-4 text-muted-foreground" />}
                {sortKey === 'type' && <Tags className="h-4 w-4 text-muted-foreground" />}
                <SelectValue placeholder="Sort by..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">
                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Date</div>
            </SelectItem>
            <SelectItem value="name">
                <div className="flex items-center gap-2"><Type className="h-4 w-4" /> Name</div>
            </SelectItem>
            <SelectItem value="type">
                <div className="flex items-center gap-2"><Tags className="h-4 w-4" /> Type</div>
            </SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={toggleSortOrder} className="h-11 px-3" aria-label={`Sort order: ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}>
          <ArrowDownUp className={`h-5 w-5 transition-transform duration-200 ${sortOrder === 'desc' ? 'rotate-0' : 'rotate-180'}`} />
        </Button>
      </div>
    </div>
  );
}
