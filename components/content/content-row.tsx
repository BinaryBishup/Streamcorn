"use client";

import { useState, useRef, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentCardHover } from "./content-card-hover";

interface ContentItem {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating?: number;
  type: "movie" | "tv" | "anime";
}

interface ContentRowProps {
  title: string;
  items: ContentItem[];
  onItemClick?: (item: ContentItem) => void;
}

const ContentRowComponent = ({ title, items, onItemClick }: ContentRowProps) => {
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
    const newScrollLeft =
      direction === "left"
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;

    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  if (items.length === 0) return null;

  return (
    <div className="relative group mb-4">
      {/* Section Title */}
      <h2 className="text-xl md:text-2xl font-semibold text-white mb-2 px-4 md:px-16">
        {title}
      </h2>

      {/* Left Arrow */}
      {showLeftArrow && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-full bg-black/50 hover:bg-black/80 rounded-none opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </Button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-2 overflow-x-auto overflow-y-visible scrollbar-hide px-4 md:px-16 scroll-smooth py-10"
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`flex-shrink-0 w-32 sm:w-40 md:w-48 ${
              index === items.length - 1 ? "mr-4 md:mr-8" : ""
            }`}
          >
            <ContentCardHover
              id={item.id}
              tmdbId={item.tmdbId}
              title={item.title}
              posterPath={item.posterPath}
              backdropPath={item.backdropPath || null}
              rating={item.rating || 0}
              type={item.type}
              onClick={() => onItemClick?.(item)}
            />
          </div>
        ))}
      </div>

      {/* Right Arrow */}
      {showRightArrow && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-full bg-black/50 hover:bg-black/80 rounded-none opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </Button>
      )}
    </div>
  );
};

export const ContentRow = memo(ContentRowComponent);
