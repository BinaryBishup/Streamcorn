"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Play, Plus, Volume2, VolumeX, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalSkeletonLoader } from "@/components/ui/skeleton-loader";
import {
  fetchMovieDetails,
  fetchTVShowDetails,
  fetchMovieImages,
  fetchTVShowImages,
  fetchSeasonDetails,
  fetchMovieRecommendations,
  fetchTVShowRecommendations,
  fetchMovieCredits,
  fetchTVShowCredits,
  getTMDBImageUrl,
  type TMDBSeason,
  type TMDBEpisode,
  type TMDBMovie,
  type TMDBTVShow,
} from "@/lib/tmdb";
import { createClient } from "@/lib/supabase/client";
import { getWatchProgress, calculateProgress, isContentCompleted, type WatchProgress } from "@/lib/watch-progress";

interface ContentDetailsModalProps {
  contentId: string;
  onClose: () => void;
}

interface Content {
  id: string;
  tmdb_id: number;
  content_type: "movie" | "tv" | "anime";
  platform_id: string;
  is_featured: boolean;
  clip: string | null;
}

type ActiveTab = "more-like-this" | "trailers";
type DetailsTab = "episodes" | "details" | "cast";

export function ContentDetailsModal({ contentId, onClose }: ContentDetailsModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<Content | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [seasons, setSeasons] = useState<TMDBSeason[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [recommendations, setRecommendations] = useState<(TMDBMovie | TMDBTVShow)[]>([]);
  const [cast, setCast] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("more-like-this");
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("episodes");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("original");
  const [recommendationContentIds, setRecommendationContentIds] = useState<Map<number, string>>(new Map());
  const [watchProgress, setWatchProgress] = useState<WatchProgress | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [trailers, setTrailers] = useState<any[]>([]);
  const [episodeProgress, setEpisodeProgress] = useState<Map<string, number>>(new Map());

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadContent();
  }, [contentId]);

  // PERFORMANCE: Don't load recommendations/cast until user clicks the tab
  useEffect(() => {
    // Load recommendations and cast only when "more-like-this" tab is active
    if (!loading && content && details && activeTab === "more-like-this" && recommendations.length === 0) {
      loadRecommendationsAndCast();
    }
  }, [activeTab, loading, content, details]);

  useEffect(() => {
    // Load watch progress after content is loaded
    if (content && profileId) {
      loadWatchProgress();
    }
  }, [content, profileId]);

  // PERFORMANCE: Increase autoplay delay to 3 seconds to prioritize content loading
  useEffect(() => {
    // Auto-play video after 3 seconds if clip or trailer exists
    if ((content?.clip || trailers.length > 0) && !showVideo) {
      const timer = setTimeout(() => {
        setShowVideo(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [content?.clip, trailers, showVideo]);

  // Auto-unmute after video starts playing (Netflix-style)
  useEffect(() => {
    if (showVideo) {
      // Wait 1 second for video to start, then unmute
      const unmuteTimer = setTimeout(() => {
        setIsMuted(false);
      }, 1000);
      return () => clearTimeout(unmuteTimer);
    }
  }, [showVideo]);

  useEffect(() => {
    // Pause video when not in view using Intersection Observer
    if (!videoContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (videoRef.current) {
            if (!entry.isIntersecting) {
              // Video is not in view, pause it
              videoRef.current.pause();
            }
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of video is out of view
      }
    );

    observer.observe(videoContainerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [showVideo]);

  useEffect(() => {
    // Load episodes when season changes (for TV shows)
    if (content?.content_type !== "movie" && selectedSeason) {
      loadEpisodes();
    }
  }, [selectedSeason, content]);

  const loadContent = async () => {
    try {
      setLoading(true);

      // Get profile ID from localStorage
      const selectedProfile = localStorage.getItem("selectedProfile");
      if (selectedProfile) {
        setProfileId(selectedProfile);
      }

      // Fetch content from Supabase
      const { data: contentData, error } = await supabase
        .from("content")
        .select("*")
        .eq("id", contentId)
        .single();

      if (error || !contentData) {
        console.error("Error loading content:", error);
        onClose();
        return;
      }

      setContent(contentData);

      // Fetch TMDB details
      const isTVContent = contentData.content_type === "tv" || contentData.content_type === "anime";
      const tmdbData = isTVContent
        ? await fetchTVShowDetails(contentData.tmdb_id, true)
        : await fetchMovieDetails(contentData.tmdb_id, true);

      setDetails(tmdbData);

      // Extract trailers and videos from TMDB data
      if (tmdbData && (tmdbData as any).videos?.results) {
        const videos = (tmdbData as any).videos.results;
        // Filter for trailers and teasers, prioritize YouTube
        const youtubeVideos = videos.filter(
          (video: any) =>
            video.site === "YouTube" &&
            (video.type === "Trailer" || video.type === "Teaser")
        );
        setTrailers(youtubeVideos);
      }

      // Fetch logo
      const images = isTVContent
        ? await fetchTVShowImages(contentData.tmdb_id)
        : await fetchMovieImages(contentData.tmdb_id);

      if (images && images.logos && images.logos.length > 0) {
        const englishLogo = images.logos.find((logo: any) => logo.iso_639_1 === "en");
        const logo = englishLogo || images.logos[0];
        setLogoPath(getTMDBImageUrl(logo.file_path, "w500"));
      }

      // Load seasons for TV shows
      if (isTVContent && (tmdbData as any)?.seasons) {
        const validSeasons = (tmdbData as any).seasons.filter(
          (s: TMDBSeason) => s.season_number > 0
        );
        setSeasons(validSeasons);
        if (validSeasons.length > 0) {
          setSelectedSeason(validSeasons[0].season_number);
          setDetailsTab("episodes");
        }
      } else {
        setDetailsTab("details");
      }
    } catch (error) {
      console.error("Error loading content details:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendationsAndCast = async () => {
    if (!content || !details) return;

    try {
      const isTVContent = content.content_type === "tv" || content.content_type === "anime";

      // Fetch recommendations
      const recs = isTVContent
        ? await fetchTVShowRecommendations(content.tmdb_id)
        : await fetchMovieRecommendations(content.tmdb_id);

      if (recs) {
        const topRecs = recs.slice(0, 10);
        setRecommendations(topRecs);

        // Find or create content entries for recommendations
        await ensureRecommendationsExist(topRecs, isTVContent ? "tv" : "movie", content.platform_id);
      }

      // Fetch cast
      const credits = isTVContent
        ? await fetchTVShowCredits(content.tmdb_id)
        : await fetchMovieCredits(content.tmdb_id);

      if (credits?.cast) {
        setCast(credits.cast.slice(0, 10));
      }
    } catch (error) {
      console.error("Error loading recommendations and cast:", error);
    }
  };

  const loadEpisodes = async () => {
    if (!content) return;

    try {
      const seasonData = await fetchSeasonDetails(content.tmdb_id, selectedSeason);
      if (seasonData && (seasonData as any).episodes) {
        setEpisodes((seasonData as any).episodes);
      }
    } catch (error) {
      console.error("Error loading episodes:", error);
    }
  };

  const loadWatchProgress = async () => {
    if (!content || !profileId) return;

    try {
      const progress = await getWatchProgress(content.id, profileId);
      setWatchProgress(progress);

      // Also load watched episodes for TV content
      const isTVContent = content.content_type === "tv" || content.content_type === "anime";
      if (isTVContent) {
        await loadWatchedEpisodes();
      }
    } catch (error) {
      console.error("Error loading watch progress:", error);
    }
  };

  const loadWatchedEpisodes = async () => {
    if (!content || !profileId) return;

    try {
      // Get all episode progress from new hybrid schema
      const progressMap = new Map<string, number>();

      // Get episode progress from continue_watching table with new JSONB structure
      const { data: continueWatchingData, error: cwError } = await supabase
        .from("continue_watching")
        .select("episodes_progress, current_season, current_episode, current_position, duration")
        .eq("profile_id", profileId)
        .eq("content_id", content.tmdb_id)
        .eq("content_type", content.content_type)
        .maybeSingle();

      if (!cwError && continueWatchingData) {
        // Parse JSONB episodes_progress {"s01e01": 120, "s01e02": 456}
        const episodesProgress = continueWatchingData.episodes_progress || {};

        for (const key of Object.keys(episodesProgress)) {
          // Convert s01e01 to S1E1 format for display
          const match = key.match(/s(\d+)e(\d+)/);
          if (match) {
            const seasonNum = parseInt(match[1]);
            const epNum = parseInt(match[2]);
            const episodeKey = `S${seasonNum}E${epNum}`;

            // Mark as in-progress (we show actual percentage for current episode)
            progressMap.set(episodeKey, 50);
          }
        }

        // Add current episode with actual progress percentage
        if (continueWatchingData.current_season && continueWatchingData.current_episode && continueWatchingData.current_position && continueWatchingData.duration) {
          const episodeKey = `S${continueWatchingData.current_season}E${continueWatchingData.current_episode}`;
          const progress = calculateProgress(continueWatchingData.current_position, continueWatchingData.duration);
          progressMap.set(episodeKey, progress);
        }
      }

      // Mark completed episodes as 100%
      const { data, error } = await supabase
        .from("watched_episodes")
        .select("season_number, episode_number")
        .eq("profile_id", profileId)
        .eq("content_id", content.id);

      if (error) throw error;

      if (data) {
        data.forEach(ep => {
          const episodeKey = `S${ep.season_number}E${ep.episode_number}`;
          // Set to 100% for completed episodes
          progressMap.set(episodeKey, 100);
        });
      }

      setEpisodeProgress(progressMap);
    } catch (error) {
      console.error("Error loading episode progress:", error);
    }
  };

  const ensureRecommendationsExist = async (
    recs: (TMDBMovie | TMDBTVShow)[],
    contentType: "movie" | "tv",
    platformId: string
  ) => {
    try {
      const idMap = new Map<number, string>();

      for (const rec of recs) {
        // Check if content already exists in database
        const { data: existing } = await supabase
          .from("content")
          .select("id")
          .eq("tmdb_id", rec.id)
          .single();

        if (existing) {
          idMap.set(rec.id, existing.id);
        } else {
          // Create new content entry
          const { data: newContent, error } = await supabase
            .from("content")
            .insert({
              tmdb_id: rec.id,
              content_type: contentType,
              platform_id: platformId,
              is_featured: false,
            })
            .select("id")
            .single();

          if (!error && newContent) {
            idMap.set(rec.id, newContent.id);
          }
        }
      }

      setRecommendationContentIds(idMap);
    } catch (error) {
      console.error("Error ensuring recommendations exist:", error);
    }
  };

  const handleRecommendationClick = (rec: TMDBMovie | TMDBTVShow) => {
    const contentDbId = recommendationContentIds.get(rec.id);
    if (contentDbId) {
      // Update URL to open the modal for this recommendation
      const currentPath = window.location.pathname;
      router.push(`${currentPath}?content=${contentDbId}`, { scroll: false });
    }
  };

  const getWatchButtonInfo = () => {
    if (!watchProgress) {
      return { text: "Watch Now", icon: Play };
    }

    // Use new hybrid schema fields (current_season, current_episode)
    const currentSeason = watchProgress.current_season || watchProgress.season_number;
    const currentEpisode = watchProgress.current_episode || watchProgress.episode_number;
    const currentPosition = watchProgress.current_position || watchProgress.last_position;

    const isCompleted = isContentCompleted(currentPosition, watchProgress.duration);
    const isTVContent = content?.content_type === "tv" || content?.content_type === "anime";

    if (isTVContent) {
      if (isCompleted && currentSeason && currentEpisode) {
        // Find next episode
        const nextEp = findNextEpisode(currentSeason, currentEpisode);
        if (nextEp) {
          return {
            text: `Play S${nextEp.season}:E${nextEp.episode}`,
            icon: Play,
          };
        }
      }

      // Show episode info in Resume button
      if (currentPosition > 0 && currentSeason && currentEpisode) {
        return {
          text: `Resume S${currentSeason} E${currentEpisode}`,
          icon: Play,
        };
      }

      return {
        text: "Watch Now",
        icon: Play,
      };
    }

    // For movies
    return {
      text: currentPosition > 0 && !isCompleted ? "Resume" : "Watch Now",
      icon: Play,
    };
  };

  const findNextEpisode = (currentSeason: number, currentEpisode: number) => {
    // Try to find next episode in current season
    const nextInSeason = episodes.find((ep: any) => ep.episode_number === currentEpisode + 1);
    if (nextInSeason) {
      return { season: currentSeason, episode: currentEpisode + 1 };
    }

    // Try to find first episode of next season
    const nextSeason = seasons.find((s: any) => s.season_number === currentSeason + 1);
    if (nextSeason) {
      return { season: currentSeason + 1, episode: 1 };
    }

    return null;
  };

  const handleClose = () => {
    // Remove content ID from URL without navigating back
    const currentPath = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.delete("content");
    const newUrl = searchParams.toString() ? `${currentPath}?${searchParams.toString()}` : currentPath;
    router.push(newUrl, { scroll: false });
    onClose();
  };

  const handlePlayContent = () => {
    if (!content || !profileId) return;

    const isTVContent = content.content_type === "tv" || content.content_type === "anime";

    // Build URL parameters
    const params = new URLSearchParams({
      profile_id: profileId,
      content_id: content.id,
    });

    // For TV shows, determine which episode to play
    if (isTVContent) {
      // Use new hybrid schema fields (current_season, current_episode) with fallback to legacy fields
      const currentSeason = watchProgress?.current_season || watchProgress?.season_number;
      const currentEpisode = watchProgress?.current_episode || watchProgress?.episode_number;
      const currentPosition = watchProgress?.current_position || watchProgress?.last_position || 0;

      if (currentSeason && currentEpisode) {
        // Check if current episode is completed
        const isCompleted = isContentCompleted(currentPosition, watchProgress?.duration || 0);

        if (isCompleted) {
          // Find next episode
          const nextEp = findNextEpisode(currentSeason, currentEpisode);
          if (nextEp) {
            params.append("season_number", nextEp.season.toString());
            params.append("episode_number", nextEp.episode.toString());
          } else {
            // No next episode, start from current
            params.append("season_number", currentSeason.toString());
            params.append("episode_number", currentEpisode.toString());
          }
        } else {
          // Continue current episode
          params.append("season_number", currentSeason.toString());
          params.append("episode_number", currentEpisode.toString());
        }
      } else {
        // Start from S1E1
        params.append("season_number", "1");
        params.append("episode_number", "1");
      }
    }

    router.push(`/player?${params.toString()}`);
  };

  const handlePlayEpisode = (seasonNumber: number, episodeNumber: number) => {
    if (!content || !profileId) return;

    const params = new URLSearchParams({
      profile_id: profileId,
      content_id: content.id,
      season_number: seasonNumber.toString(),
      episode_number: episodeNumber.toString(),
    });

    router.push(`/player?${params.toString()}`);
  };

  if (loading) {
    return <ModalSkeletonLoader />;
  }

  if (!content || !details) {
    return null;
  }

  const isTVContent = content.content_type === "tv" || content.content_type === "anime";
  const title = isTVContent ? details.name : details.title;
  const backdropPath = getTMDBImageUrl(details.backdrop_path, "w1280");
  const year = isTVContent
    ? details.first_air_date?.substring(0, 4)
    : details.release_date?.substring(0, 4);
  const runtime = isTVContent ? null : details.runtime;
  const rating = details.vote_average;

  // Get available languages
  const languages = details.spoken_languages || [];
  const originalLanguage = details.original_language || "en";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/90 animate-in fade-in duration-300"
      onClick={handleClose}
    >
      <div className="min-h-screen flex items-start justify-center pt-4 md:pt-10 px-2 md:px-4">
        <div
          className="relative w-full max-w-6xl bg-[#181818] rounded-lg overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/80 hover:bg-black flex items-center justify-center transition-colors border border-white/30"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Hero Section */}
          <div ref={videoContainerRef} className="relative w-full aspect-video">
            {showVideo && content?.clip ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  src={content.clip}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                />
                {/* Mute Button */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/80 hover:bg-black flex items-center justify-center transition-colors border border-white/30 z-10"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-white" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            ) : showVideo && trailers.length > 0 ? (
              <div className="relative w-full h-full">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${trailers[0].key}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0&showinfo=0`}
                  title={trailers[0].name}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
                {/* Mute Button */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/80 hover:bg-black flex items-center justify-center transition-colors border border-white/30 z-10"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-white" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            ) : (
              <div className="relative w-full h-full">
                {backdropPath ? (
                  <Image
                    src={backdropPath}
                    alt={title}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
                )}
              </div>
            )}

            {/* Gradient Overlay - Clear at top, grey at bottom */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#181818]" />

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
              {/* Logo/Trailer and Buttons Container */}
              <div className="flex items-end justify-between gap-6 mb-6">
                {/* Left: Logo or Title */}
                <div className="flex-shrink-0">
                  {logoPath ? (
                    <div className="relative h-16 md:h-24 w-48 md:w-80">
                      <Image
                        src={logoPath}
                        alt={`${title} logo`}
                        fill
                        className="object-contain object-left"
                      />
                    </div>
                  ) : (
                    <h1 className="text-3xl md:text-5xl font-bold text-white">{title}</h1>
                  )}
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="relative">
                    <Button
                      onClick={handlePlayContent}
                      className="bg-white hover:bg-gray-200 text-black font-semibold px-8 py-6 text-base md:text-lg rounded-md overflow-hidden"
                    >
                      <Play className="w-5 h-5 md:w-6 md:h-6 mr-2" fill="currentColor" />
                      {getWatchButtonInfo().text}
                      {/* Progress bar integrated into button */}
                      {watchProgress && watchProgress.duration > 0 && (
                        (() => {
                          const position = watchProgress.current_position || watchProgress.last_position || 0;
                          return position > 0 ? (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300">
                              <div
                                className="h-full bg-red-600"
                                style={{
                                  width: `${calculateProgress(position, watchProgress.duration)}%`,
                                }}
                              />
                            </div>
                          ) : null;
                        })()
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/30 font-semibold p-3 rounded-full"
                  >
                    <Plus className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs and Content Section */}
          <div className="p-6 md:p-10">
            {/* Details Tabs (Episodes, Details, Cast) - Now First */}
            <div>
              <div className="flex gap-8 mb-6 border-b border-gray-800">
                {isTVContent && seasons.length > 0 && (
                  <button
                    onClick={() => setDetailsTab("episodes")}
                    className={`pb-3 text-base font-semibold transition-colors relative ${
                      detailsTab === "episodes"
                        ? "text-white"
                        : "text-gray-400 hover:text-gray-300"
                    }`}
                  >
                    Episodes
                    {detailsTab === "episodes" && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setDetailsTab("details")}
                  className={`pb-3 text-base font-semibold transition-colors relative ${
                    detailsTab === "details"
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Details
                  {detailsTab === "details" && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t" />
                  )}
                </button>
                <button
                  onClick={() => setDetailsTab("cast")}
                  className={`pb-3 text-base font-semibold transition-colors relative ${
                    detailsTab === "cast"
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Cast
                  {detailsTab === "cast" && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t" />
                  )}
                </button>
              </div>

              {/* Episodes Tab */}
              {detailsTab === "episodes" && isTVContent && seasons.length > 0 && (
                <div>
                  {/* Season Selector */}
                  <div className="flex gap-2 mb-6 flex-wrap">
                    {seasons.map((season) => (
                      <button
                        key={season.id}
                        onClick={() => setSelectedSeason(season.season_number)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          selectedSeason === season.season_number
                            ? "bg-white text-black"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        Season {season.season_number}
                      </button>
                    ))}
                  </div>

                  {/* Episodes List */}
                  <div className="space-y-4">
                    {episodes.map((episode, index) => {
                      const episodeKey = `S${selectedSeason}E${episode.episode_number}`;
                      const progress = episodeProgress.get(episodeKey) || 0;
                      const isFullyWatched = progress === 100;
                      const hasProgress = progress > 0 && progress < 100;

                      return (
                        <div
                          key={episode.id}
                          onClick={() => handlePlayEpisode(selectedSeason, episode.episode_number)}
                          className="flex gap-4 bg-gray-900/50 rounded-lg overflow-hidden hover:bg-gray-900/70 transition-colors cursor-pointer"
                        >
                          {/* Episode Thumbnail */}
                          <div className="relative w-40 md:w-60 flex-shrink-0 aspect-video">
                            {episode.still_path ? (
                              <Image
                                src={getTMDBImageUrl(episode.still_path, "w500")}
                                alt={episode.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <span className="text-gray-500 text-sm">No image</span>
                              </div>
                            )}

                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                              <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center">
                                <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
                              </div>
                            </div>

                            {/* Progress bar for in-progress episodes */}
                            {hasProgress && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                                <div
                                  className="h-full bg-red-600"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Episode Info */}
                          <div className="flex-1 py-4 pr-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <h3 className="text-white font-semibold text-base">
                                  {episode.episode_number}. {episode.name}
                                </h3>
                                {isFullyWatched && (
                                  <span className="text-xs px-2 py-0.5 bg-red-600/20 text-red-500 rounded font-medium border border-red-600/30">
                                    Complete
                                  </span>
                                )}
                              </div>
                              {episode.runtime && (
                                <span className="text-gray-400 text-sm whitespace-nowrap ml-4">{episode.runtime}m</span>
                              )}
                            </div>
                            {episode.air_date && (
                              <p className="text-gray-400 text-sm mb-2">
                                {new Date(episode.air_date).toLocaleDateString('en-US', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </p>
                            )}
                            <p className="text-gray-300 text-sm leading-relaxed line-clamp-2">
                              {episode.overview || "No description available."}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Details Tab */}
              {detailsTab === "details" && (
                <div className="space-y-6">
                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-sm md:text-base">
                    <span className="text-white font-semibold">{year}</span>
                    {rating > 0 && (
                      <>
                        <span className="text-white">•</span>
                        <span className="text-white font-semibold">
                          {rating.toFixed(1)} ★
                        </span>
                      </>
                    )}
                    {isTVContent && seasons.length > 0 ? (
                      <>
                        <span className="text-white">•</span>
                        <span className="text-white">
                          {seasons.length} {seasons.length === 1 ? "Season" : "Seasons"}
                        </span>
                      </>
                    ) : runtime ? (
                      <>
                        <span className="text-white">•</span>
                        <span className="text-white">{Math.floor(runtime / 60)}h {runtime % 60}m</span>
                      </>
                    ) : null}
                  </div>

                  {/* Genres */}
                  {details.genres && details.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {details.genres.slice(0, 4).map((genre: any) => (
                        <span
                          key={genre.id}
                          className="text-white text-xs md:text-sm font-medium"
                        >
                          {genre.name}
                          {details.genres.indexOf(genre) < Math.min(details.genres.length - 1, 3) && (
                            <span className="mx-2">|</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Overview */}
                  <p className="text-white/90 text-sm md:text-base leading-relaxed">
                    {details.overview}
                  </p>

                  {/* Language Tabs */}
                  {languages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedLanguage("original")}
                        className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                          selectedLanguage === "original"
                            ? "bg-white/20 text-white"
                            : "bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {languages.find((l: any) => l.iso_639_1 === originalLanguage)?.english_name || "Original"}
                      </button>
                      {languages.filter((l: any) => l.iso_639_1 !== originalLanguage).slice(0, 3).map((lang: any) => (
                        <button
                          key={lang.iso_639_1}
                          onClick={() => setSelectedLanguage(lang.iso_639_1)}
                          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                            selectedLanguage === lang.iso_639_1
                              ? "bg-white/20 text-white"
                              : "bg-white/5 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {lang.english_name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Platform */}
                  {content.platform_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Available on: </span>
                      <div className="flex items-center gap-2">
                        {content.platform_id === 'netflix' && (
                          <img src="/ott-logos/netflix.png" alt="Netflix" className="h-6 object-contain" />
                        )}
                        {content.platform_id === 'prime-video' && (
                          <img src="/ott-logos/prime-video.png" alt="Prime Video" className="h-6 object-contain" />
                        )}
                        {content.platform_id === 'jiohotstar' && (
                          <img src="/ott-logos/jioHotstar.png" alt="JioHotstar" className="h-6 object-contain" />
                        )}
                        {content.platform_id === 'zee5' && (
                          <img src="/ott-logos/zee5.webp" alt="ZEE5" className="h-6 object-contain" />
                        )}
                        {content.platform_id === 'hoichoi' && (
                          <img src="/ott-logos/hoichoi.png" alt="hoichoi" className="h-6 object-contain" />
                        )}
                        {content.platform_id === 'crunchyroll' && (
                          <img src="/ott-logos/crunchyroll.png" alt="Crunchyroll" className="h-6 object-contain" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Production */}
                  {details.production_companies && details.production_companies.length > 0 && (
                    <div>
                      <span className="text-gray-400">Production: </span>
                      <span className="text-white">
                        {details.production_companies.map((c: any) => c.name).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Cast Tab */}
              {detailsTab === "cast" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {cast.map((member: any) => {
                    const profileImage = member.profile_path
                      ? getTMDBImageUrl(member.profile_path, "w500")
                      : null;
                    return (
                      <div key={member.id} className="text-center">
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-gray-800">
                          {profileImage ? (
                            <Image
                              src={profileImage}
                              alt={member.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-gray-500 text-xs">No photo</span>
                            </div>
                          )}
                        </div>
                        <h4 className="text-white text-sm font-medium line-clamp-1">{member.name}</h4>
                        <p className="text-gray-400 text-xs line-clamp-1">{member.character}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* More Like This and Trailers Tabs - Now Below */}
            <div className="mt-10">
              <div className="flex gap-8 mb-8 border-b border-gray-800">
                <button
                  onClick={() => setActiveTab("more-like-this")}
                  className={`pb-3 text-lg font-semibold transition-colors relative ${
                    activeTab === "more-like-this"
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  More Like This
                  {activeTab === "more-like-this" && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("trailers")}
                  className={`pb-3 text-lg font-semibold transition-colors relative ${
                    activeTab === "trailers"
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Trailers & More
                  {activeTab === "trailers" && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t" />
                  )}
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === "more-like-this" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                  {recommendations.map((rec: any) => {
                    const recTitle = rec.title || rec.name;
                    const recPoster = getTMDBImageUrl(rec.poster_path, "w500");
                    return (
                      <div
                        key={rec.id}
                        onClick={() => handleRecommendationClick(rec)}
                        className="group cursor-pointer transition-transform hover:scale-105 duration-200"
                      >
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2">
                          <Image
                            src={recPoster}
                            alt={recTitle}
                            fill
                            className="object-cover"
                          />
                          {/* Play button overlay on hover */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                              <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
                            </div>
                          </div>
                        </div>
                        <h3 className="text-white text-sm font-medium line-clamp-1">{recTitle}</h3>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Trailers Tab */}
              {activeTab === "trailers" && (
                <div>
                  {trailers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {trailers.map((trailer: any, index: number) => (
                        <div
                          key={trailer.id || index}
                          className="relative aspect-video rounded-lg overflow-hidden bg-gray-900"
                        >
                          <iframe
                            className="absolute inset-0 w-full h-full"
                            src={`https://www.youtube.com/embed/${trailer.key}?rel=0&modestbranding=1&showinfo=0`}
                            title={trailer.name}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-gray-400 text-lg">No trailers available for this content</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
