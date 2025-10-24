"use client";

import { useState, useRef, memo } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMovieDetails, fetchTVShowDetails, getTMDBImageUrl, fetchMovieImages, fetchTVShowImages } from "@/lib/tmdb";
import { calculateProgress, type ContinueWatchingItem } from "@/lib/watch-progress";
import Image from "next/image";
import { useEffect } from "react";

interface ContinueWatchingRowProps {
  items: ContinueWatchingItem[];
  onItemClick?: (item: ContinueWatchingItem) => void;
}

interface ItemWithMetadata extends ContinueWatchingItem {
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  logoPath: string | null;
}

const ContinueWatchingRowComponent = ({ items, onItemClick }: ContinueWatchingRowProps) => {
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [itemsWithMetadata, setItemsWithMetadata] = useState<ItemWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMetadata();
  }, [items]);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const withMetadata = await Promise.all(
        items.map(async (item) => {
          const isTVContent = item.content.content_type === "tv" || item.content.content_type === "anime";
          const tmdbData = isTVContent
            ? await fetchTVShowDetails(item.content.tmdb_id)
            : await fetchMovieDetails(item.content.tmdb_id);

          // Fetch logo images
          const images = isTVContent
            ? await fetchTVShowImages(item.content.tmdb_id)
            : await fetchMovieImages(item.content.tmdb_id);

          // Get English logo or first available logo
          const logo = images?.logos?.find(l => l.iso_639_1 === "en") || images?.logos?.[0];
          const logoPath = logo ? getTMDBImageUrl(logo.file_path, "w500") : null;

          return {
            ...item,
            title: isTVContent ? (tmdbData as any)?.name : (tmdbData as any)?.title,
            posterPath: getTMDBImageUrl(tmdbData?.poster_path || null, "w500"),
            backdropPath: getTMDBImageUrl(tmdbData?.backdrop_path || null, "w1280"),
            logoPath,
          };
        })
      );
      setItemsWithMetadata(withMetadata);
    } catch (error) {
      console.error("Error loading continue watching metadata:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const getProgressText = (item: ContinueWatchingItem) => {
    const isTVContent = item.content.content_type === "tv" || item.content.content_type === "anime";
    if (isTVContent && item.season_number && item.episode_number) {
      return `S${item.season_number}:E${item.episode_number}`;
    }
    return null;
  };

  if (loading || itemsWithMetadata.length === 0) return null;

  return (
    <div className="relative group mb-8">
      {/* Section Title */}
      <h2 className="text-xl md:text-2xl font-semibold text-white mb-2 px-4 md:px-16">
        Continue Watching
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
        className="flex gap-2 overflow-x-auto overflow-y-visible scrollbar-hide px-4 md:px-16 scroll-smooth py-12"
      >
        {itemsWithMetadata.map((item, index) => {
          const progress = calculateProgress(item.last_position, item.duration);
          const progressText = getProgressText(item);

          return (
            <div
              key={item.id}
              className={`flex-shrink-0 w-64 sm:w-80 md:w-96 ${
                index === itemsWithMetadata.length - 1 ? "mr-4 md:mr-8" : ""
              }`}
            >
              <div
                className="group/item cursor-pointer transition-transform hover:scale-105 duration-200"
                onClick={() => onItemClick?.(item)}
              >
                {/* Backdrop with landscape view */}
                <div className="relative aspect-video rounded-lg overflow-hidden mb-2">
                  {item.backdropPath ? (
                    <Image
                      src={item.backdropPath}
                      alt={item.title}
                      fill
                      className="object-cover"
                      loading="lazy"
                      quality={75}
                      sizes="(max-width: 768px) 256px, 384px"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <span className="text-gray-500 text-xs">No image</span>
                    </div>
                  )}

                  {/* Gradient overlay for better text visibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Logo or Title at bottom left */}
                  {item.logoPath ? (
                    <div className="absolute bottom-4 left-4 w-32 h-12">
                      <Image
                        src={item.logoPath}
                        alt={`${item.title} logo`}
                        fill
                        className="object-contain object-left"
                      />
                    </div>
                  ) : (
                    <h3 className="absolute bottom-4 left-4 text-white text-lg font-bold line-clamp-2 max-w-[80%]">
                      {item.title}
                    </h3>
                  )}

                  {/* Episode info */}
                  {progressText && (
                    <p className="absolute bottom-4 right-4 text-white text-sm font-medium bg-black/60 px-2 py-1 rounded">
                      {progressText}
                    </p>
                  )}

                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                    </div>
                  </div>

                  {/* Progress bar at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                    <div
                      className="h-full bg-red-600"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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

export const ContinueWatchingRow = memo(ContinueWatchingRowComponent);
