"use client";

import { useState, useEffect, useRef, memo } from "react";
import Image from "next/image";
import { Play, Plus, ChevronDown, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchMovieImages, fetchTVShowImages, fetchMovieDetails, fetchTVShowDetails, getTMDBImageUrl, fetchMovieVideos, fetchTVShowVideos } from "@/lib/tmdb";
import { createClient } from "@/lib/supabase/client";

interface ContentCardProps {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  type: "movie" | "tv" | "anime";
  onClick?: () => void;
}

const ContentCardHoverComponent = ({
  id,
  tmdbId,
  title,
  posterPath,
  backdropPath,
  rating,
  type,
  onClick,
}: ContentCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [overview, setOverview] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [genres, setGenres] = useState<string[]>([]);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [seasons, setSeasons] = useState<number>(0);
  const [episodes, setEpisodes] = useState<number>(0);
  const [position, setPosition] = useState<"left" | "center" | "right">("center");
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isHovered && !logoPath) {
      // Fetch details when hovering for the first time
      fetchDetails();
    }
  }, [isHovered, logoPath]);


  const fetchDetails = async () => {
    try {
      // Fetch clip URL from database
      const { data: contentData, error: contentError } = await supabase
        .from("content")
        .select("clip")
        .eq("id", id)
        .single();

      if (!contentError && contentData?.clip) {
        setClipUrl(contentData.clip);
      }

      // Fetch images
      const images = type === "movie"
        ? await fetchMovieImages(tmdbId)
        : await fetchTVShowImages(tmdbId);

      if (images && images.logos && images.logos.length > 0) {
        // Prefer English logos
        const englishLogo = images.logos.find(logo => logo.iso_639_1 === "en");
        const logo = englishLogo || images.logos[0];
        setLogoPath(getTMDBImageUrl(logo.file_path, "w500"));
      }

      // Fetch content details
      const details = type === "movie"
        ? await fetchMovieDetails(tmdbId)
        : await fetchTVShowDetails(tmdbId);

      if (details) {
        setOverview(details.overview || "");

        // Get year
        const releaseDate = type === "movie"
          ? (details as any).release_date
          : (details as any).first_air_date;
        if (releaseDate) {
          setYear(releaseDate.substring(0, 4));
        }

        // Get genres
        if (details.genres && details.genres.length > 0) {
          setGenres(details.genres.slice(0, 3).map((g: any) => g.name));
        }

        // Get seasons and episodes for TV shows and anime
        if (type === "tv" || type === "anime") {
          const tvDetails = details as any;
          if (tvDetails.number_of_seasons) {
            setSeasons(tvDetails.number_of_seasons);
          }
          if (tvDetails.number_of_episodes) {
            setEpisodes(tvDetails.number_of_episodes);
          }
        }
      }

      // Fetch trailer from TMDB as fallback if no clip URL
      if (!contentData?.clip) {
        const videos = type === "movie"
          ? await fetchMovieVideos(tmdbId)
          : await fetchTVShowVideos(tmdbId);

        if (videos && videos.results && videos.results.length > 0) {
          // Find the first trailer or teaser
          const trailer = videos.results.find(
            (v: any) => v.type === "Trailer" && v.site === "YouTube"
          ) || videos.results.find(
            (v: any) => v.type === "Teaser" && v.site === "YouTube"
          ) || videos.results[0];

          if (trailer && trailer.key) {
            setTrailerKey(trailer.key);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching details:", error);
    }
  };

  const handleMouseEnter = () => {
    // Detect position on hover
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const cardCenter = rect.left + rect.width / 2;

      // Determine if card is on left, center, or right edge
      // Left edge: within first 20% of screen
      // Right edge: within last 20% of screen
      if (cardCenter < windowWidth * 0.2) {
        setPosition("left");
      } else if (cardCenter > windowWidth * 0.8) {
        setPosition("right");
      } else {
        setPosition("center");
      }
    }

    const timeout = setTimeout(() => {
      setIsHovered(true);
    }, 300);
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsHovered(false);
    setIsVideoReady(false);
    setIsMuted(false); // Reset to unmuted for next hover

    // Pause and reset video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleVideoReady = () => {
    setIsVideoReady(true);
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.error("Error playing video:", error);
      });
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  // Use clip first, fallback to trailer
  const videoUrl = clipUrl || (trailerKey ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&showinfo=0&modestbranding=1&loop=1&playlist=${trailerKey}&rel=0&iv_load_policy=3&disablekb=1&fs=0&playsinline=1` : null);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't pause video, just trigger the onClick handler
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      ref={cardRef}
      className={`relative transition-all duration-300 ease-in-out ${
        isHovered ? "scale-[1.3] z-50 mx-8" : "scale-100 z-10"
      } ${
        position === "left"
          ? "origin-left"
          : position === "right"
          ? "origin-right"
          : "origin-center"
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {/* Poster - Always visible */}
      <div className="relative aspect-[2/3] rounded overflow-hidden cursor-pointer">
        {posterPath ? (
          <Image
            src={posterPath}
            alt={title}
            fill
            className="object-cover transition-transform duration-300"
            sizes="(max-width: 768px) 150px, 200px"
            loading="lazy"
            quality={75}
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <span className="text-gray-500 text-sm text-center px-2">{title}</span>
          </div>
        )}
      </div>

      {/* Hover Expansion */}
      {isHovered && (
        <div
          className={`absolute top-0 w-full min-w-[320px] max-w-[340px] bg-[#181818] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 cursor-pointer ${
            position === "left"
              ? "left-0 origin-left"
              : position === "right"
              ? "right-0 origin-right"
              : "left-1/2 -translate-x-1/2 origin-center"
          }`}
        >
          {/* Video/Backdrop */}
          <div className="relative w-full aspect-[16/10]">
            {videoUrl && clipUrl ? (
              // Direct video file from database
              <>
                <video
                  ref={videoRef}
                  src={clipUrl}
                  autoPlay
                  muted={isMuted}
                  loop
                  playsInline
                  className="w-full h-full"
                  onLoadedData={handleVideoReady}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 z-20 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4 text-white" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-white" />
                  )}
                </Button>
              </>
            ) : videoUrl && trailerKey ? (
              // YouTube trailer fallback
              <iframe
                src={videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 'none' }}
              />
            ) : backdropPath ? (
              <Image
                src={backdropPath}
                alt={title}
                fill
                className="object-cover"
                sizes="300px"
                loading="lazy"
                quality={85}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#181818]" />
            )}

            {/* Minimal Gradient Overlay - only at bottom for logo visibility */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#181818]/60 to-transparent pointer-events-none" />

            {/* Logo at bottom */}
            {logoPath ? (
              <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none">
                <div className="relative h-12 w-32">
                  <Image
                    src={logoPath}
                    alt={`${title} logo`}
                    fill
                    className="object-contain object-left drop-shadow-lg"
                    sizes="128px"
                    loading="lazy"
                    quality={90}
                  />
                </div>
              </div>
            ) : (
              <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none">
                <h3 className="text-white text-lg font-bold drop-shadow-lg">{title}</h3>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="p-2 bg-[#181818]">
            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <Button
                size="icon"
                className="h-7 w-7 rounded-full bg-white hover:bg-white/90 text-black transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
              >
                <Play className="h-3.5 w-3.5" fill="currentColor" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 rounded-full border border-gray-400 bg-transparent hover:border-white transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 rounded-full border border-gray-400 bg-transparent hover:border-white ml-auto transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.();
                }}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Compact Info Row */}
            <div className="flex items-center gap-1.5 text-[10px] mb-1">
              {year && <span className="text-white font-semibold">{year}</span>}
              {year && <span className="text-gray-400">•</span>}
              {rating > 0 && (
                <>
                  <span className="text-yellow-400">★</span>
                  <span className="text-white font-semibold">{rating.toFixed(1)}</span>
                  <span className="text-gray-400">•</span>
                </>
              )}
              <span className="text-gray-400 uppercase">{type}</span>
              {(type === "tv" || type === "anime") && seasons > 0 && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-white font-semibold">{seasons} Season{seasons > 1 ? 's' : ''}</span>
                  {episodes > 0 && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-white/70">{episodes} Ep</span>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Genres - Compact single line */}
            {genres.length > 0 && (
              <p className="text-white/70 text-[10px] truncate">
                {genres.join(" • ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ContentCardHover = memo(ContentCardHoverComponent);
