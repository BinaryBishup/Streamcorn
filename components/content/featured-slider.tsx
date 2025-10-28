"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Play, Info, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMovieImages, fetchTVShowImages, getTMDBImageUrl } from "@/lib/tmdb";

interface FeaturedItem {
  id: string;
  tmdbId: number;
  title: string;
  overview?: string;
  backdropPath?: string | null;
  posterPath?: string | null;
  rating?: number;
  type: "movie" | "tv" | "anime";
  trailerKey?: string;
}

interface FeaturedSliderProps {
  items: FeaturedItem[];
  autoPlayInterval?: number;
}

export function FeaturedSlider({ items, autoPlayInterval = 5000 }: FeaturedSliderProps) {
  const searchParams = useSearchParams();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [trailerEnded, setTrailerEnded] = useState(false);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if modal is open by checking URL params
  useEffect(() => {
    const contentParam = searchParams.get("content");
    setIsModalOpen(!!contentParam);
    if (contentParam) {
      setShowTrailer(false); // Stop trailer when modal opens
    }
  }, [searchParams]);

  useEffect(() => {
    if (items.length <= 1 || isPaused || showTrailer) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [items.length, autoPlayInterval, isPaused, showTrailer]);

  // Viewport detection and window visibility
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (!entry.isIntersecting) {
          setShowTrailer(false);
          setTrailerEnded(false);
        }
      },
      { threshold: 0.5 }
    );

    // Pause trailer when window/tab is not active
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setShowTrailer(false);
        setTrailerEnded(false);
      }
    };

    observer.observe(containerRef.current);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Auto-play trailer after 2 seconds if available, in view, and modal is not open
  useEffect(() => {
    setShowTrailer(false);
    setTrailerEnded(false);

    const currentItem = items[currentIndex];
    if (!currentItem?.trailerKey || !isInView || isModalOpen) return;

    const timer = setTimeout(() => {
      setShowTrailer(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentIndex, items, isInView, isModalOpen]);

  // Fetch logo when current item changes
  useEffect(() => {
    const currentItem = items[currentIndex];
    if (!currentItem) return;

    const fetchLogo = async () => {
      try {
        const images = currentItem.type === "movie"
          ? await fetchMovieImages(currentItem.tmdbId)
          : await fetchTVShowImages(currentItem.tmdbId);

        if (images && images.logos && images.logos.length > 0) {
          const englishLogo = images.logos.find(logo => logo.iso_639_1 === "en");
          const logo = englishLogo || images.logos[0];
          setLogoPath(getTMDBImageUrl(logo.file_path, "w500"));
        } else {
          setLogoPath(null);
        }
      } catch (error) {
        console.error("Error fetching logo:", error);
        setLogoPath(null);
      }
    };

    fetchLogo();
  }, [currentIndex, items]);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[60vh] md:h-[75vh] lg:h-[85vh] overflow-hidden mt-16"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Image or Trailer */}
      <div className="absolute inset-0">
        {showTrailer && currentItem.trailerKey && !trailerEnded ? (
          <div className="relative w-full h-full">
            {/* Black background on left */}
            <div className="absolute inset-0 bg-black" />

            {/* Trailer positioned on right side */}
            <div className="absolute top-0 right-0 bottom-0 w-[85%] md:w-[80%] lg:w-[75%]">
              <iframe
                key={`${currentItem.trailerKey}-${isMuted}`}
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${currentItem.trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&rel=0&enablejsapi=1&end=120`}
                title={`${currentItem.title} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={(e) => {
                  // Listen for video end event
                  const iframe = e.currentTarget;
                  const checkEnded = setInterval(() => {
                    try {
                      iframe.contentWindow?.postMessage('{"event":"command","func":"getPlayerState","args":""}', '*');
                    } catch (err) {
                      // Ignore cross-origin errors
                    }
                  }, 1000);

                  window.addEventListener('message', (event) => {
                    if (event.data && typeof event.data === 'string') {
                      try {
                        const data = JSON.parse(event.data);
                        if (data.event === 'onStateChange' && data.info === 0) {
                          setTrailerEnded(true);
                          clearInterval(checkEnded);
                        }
                      } catch (err) {
                        // Ignore parsing errors
                      }
                    }
                  });

                  return () => clearInterval(checkEnded);
                }}
              />
              {/* Gradient from left to blend with black background */}
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent pointer-events-none" style={{ width: '40%' }} />
              {/* Bottom gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />
            </div>

            {/* Mute/Unmute Button */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="absolute bottom-24 right-8 md:right-16 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center transition-colors z-10 border border-white/50"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        ) : (
          <>
            {currentItem.backdropPath ? (
              <Image
                src={currentItem.backdropPath}
                alt={currentItem.title}
                fill
                className="object-cover"
                priority
                sizes="100vw"
                quality={85}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black" />
            )}
            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-transparent" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end px-4 md:px-8 lg:px-16 pb-16 md:pb-20">
        {/* Logo or Title */}
        {logoPath ? (
          <div className="relative w-64 md:w-96 lg:w-[500px] h-24 md:h-32 lg:h-40 mb-4">
            <Image
              src={logoPath}
              alt={currentItem.title}
              fill
              className="object-contain object-left"
              sizes="(max-width: 768px) 256px, (max-width: 1024px) 384px, 500px"
              priority
              quality={90}
            />
          </div>
        ) : (
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4 max-w-2xl drop-shadow-lg">
            {currentItem.title}
          </h1>
        )}

        {/* Overview */}
        {currentItem.overview && (
          <p className="text-sm md:text-base lg:text-lg text-white/90 mb-6 max-w-xl lg:max-w-2xl line-clamp-3 drop-shadow-lg">
            {currentItem.overview}
          </p>
        )}

        {/* Rating */}
        {currentItem.rating && currentItem.rating > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <span className="text-yellow-400 text-lg md:text-xl">★</span>
            <span className="text-white text-lg md:text-xl font-semibold">
              {currentItem.rating.toFixed(1)}
            </span>
            <span className="text-white/70 text-sm md:text-base uppercase px-2 py-0.5 bg-white/20 rounded">
              {currentItem.type}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button className="bg-white hover:bg-white/90 text-black font-semibold px-6 md:px-8 py-2 md:py-3 text-base md:text-lg rounded">
            <Play className="w-5 h-5 md:w-6 md:h-6 mr-2" fill="currentColor" />
            Play
          </Button>
          <Button
            variant="outline"
            className="bg-gray-500/50 hover:bg-gray-500/70 text-white border-none font-semibold px-6 md:px-8 py-2 md:py-3 text-base md:text-lg rounded"
          >
            <Info className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            More Info
          </Button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {items.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/80 rounded-full w-10 h-10 md:w-12 md:h-12"
            onClick={goToPrevious}
          >
            <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 text-white" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/80 rounded-full w-10 h-10 md:w-12 md:h-12"
            onClick={goToNext}
          >
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8 text-white" />
          </Button>
        </>
      )}

      {/* Thumbnail Navigation */}
      {items.length > 1 && (
        <div className="absolute bottom-4 md:bottom-6 right-4 md:right-8 lg:right-16 flex gap-2 z-10">
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`relative w-12 h-16 md:w-16 md:h-20 rounded overflow-hidden transition-all ${
                index === currentIndex
                  ? "ring-2 ring-white scale-110"
                  : "opacity-60 hover:opacity-100"
              }`}
              aria-label={`Go to ${item.title}`}
            >
              {item.posterPath ? (
                <Image
                  src={item.posterPath}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 48px, 64px"
                  loading="lazy"
                  quality={60}
                />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white text-xs">
                  {index + 1}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
