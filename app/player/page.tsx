"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Hls from "hls.js";
import {
  ArrowLeft,
  X,
  Check,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipForward,
  List,
  Minimize,
  Lock,
  AudioLines,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchTVShowDetails, fetchSeasonDetails, fetchEpisodeDetails, getTMDBImageUrl } from "@/lib/tmdb";
import Image from "next/image";
import { useSubscription } from "@/contexts/subscription-context";
import { getAvailableQualities, getRequiredPlanForQuality, type VideoQuality } from "@/lib/subscription";
import { UpgradeDrawer } from "@/components/subscription/upgrade-drawer";

interface ContentData {
  id: string;
  tmdb_id: number;
  content_type: string;
  duration: number;
  platform_id: string;
  video_url: { hls_url: string } | null;
}

interface EpisodeData {
  id: string;
  episode_number: number;
  season_id: string;
  duration: number;
  skip_intro_start: number | null;
  skip_intro_end: number | null;
  skip_credits_start: number | null;
  video_url: { hls_url: string } | null;
}

interface SeasonData {
  season_number: number;
  id: string;
}

interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  still_path: string | null;
  overview: string;
  runtime: number;
}

function PlayerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { plan, subscription } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentData | null>(null);
  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [seasonData, setSeasonData] = useState<SeasonData | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<string[]>([]);
  const [availableSubtitles, setAvailableSubtitles] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [selectedAudio, setSelectedAudio] = useState<number>(-1);
  const [selectedSubtitle, setSelectedSubtitle] = useState<number>(-1);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showAudioSubtitlesMenu, setShowAudioSubtitlesMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showUpgradeDrawer, setShowUpgradeDrawer] = useState(false);
  const [requiredPlanForUpgrade, setRequiredPlanForUpgrade] = useState<"basic" | "premium" | "ultra" | undefined>();
  const [keyboardFeedback, setKeyboardFeedback] = useState<{ icon: React.ReactNode; text?: string } | null>(null);
  const [volumeHovered, setVolumeHovered] = useState(false);
  const [currentQualityLabel, setCurrentQualityLabel] = useState<string>("Auto");
  const [allEpisodes, setAllEpisodes] = useState<TMDBEpisode[]>([]);
  const [episodeProgress, setEpisodeProgress] = useState<Map<string, number>>(new Map());
  const [currentSeason, setCurrentSeason] = useState<number>(1);
  const [currentEpisode, setCurrentEpisode] = useState<number>(1);
  const [contentTitle, setContentTitle] = useState<string>("");
  const [episodeTitle, setEpisodeTitle] = useState<string>("");
  const [allSeasons, setAllSeasons] = useState<SeasonData[]>([]);

  // Video player state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipCredits, setShowSkipCredits] = useState(false);
  const [expandedEpisode, setExpandedEpisode] = useState<number>(1);
  const [showSeasonSelector, setShowSeasonSelector] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [showNextEpisodeHover, setShowNextEpisodeHover] = useState(false);
  const [savedPosition, setSavedPosition] = useState<number | null>(null);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const [showAutoPlayOverlay, setShowAutoPlayOverlay] = useState(false);
  const [completionThreshold, setCompletionThreshold] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nextEpisodeHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentEpisodeRef = useRef<HTMLDivElement>(null);
  const autoPlayCountdownRef = useRef<NodeJS.Timeout | null>(null);

  const profileId = searchParams.get("profile_id");
  const contentId = searchParams.get("content_id");
  const episodeId = searchParams.get("episode_id");
  const seasonNumber = searchParams.get("season_number");
  const episodeNumber = searchParams.get("episode_number");
  const testUrl = searchParams.get("test_url");

  useEffect(() => {
    // Test mode - bypass database if test_url is provided
    if (testUrl) {
      setVideoUrl(decodeURIComponent(testUrl));
      setContentTitle("Test Video");
      setLoading(false);
      return;
    }

    if (!profileId || !contentId) {
      router.push("/");
      return;
    }

    loadPlayerData();
  }, [profileId, contentId, episodeId, seasonNumber, episodeNumber, testUrl]);

  // HLS.js initialization
  useEffect(() => {
    // Only initialize when loading is complete
    if (loading) return;
    if (!videoUrl || !videoRef.current) return;

    const video = videoRef.current;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hlsRef.current = hls;
      hls.loadSource(videoUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Get available quality levels
        const levels = hls.levels.map((level, index) =>
          `${level.height}p (${Math.round(level.bitrate / 1000)}kbps)`
        );
        setAvailableQualities(["Auto", ...levels]);
        setSelectedQuality(hls.currentLevel + 1); // +1 because "Auto" is at index 0

        // Get available audio tracks
        const audioTracks = hls.audioTracks.map(track => track.name || track.lang || `Track ${track.id}`);
        setAvailableAudioTracks(audioTracks);
        if (audioTracks.length > 0) {
          setSelectedAudio(hls.audioTrack);
        }

        // Get available subtitle tracks
        const subtitleTracks = hls.subtitleTracks.map(track => track.name || track.lang || `Track ${track.id}`);
        setAvailableSubtitles(["Off", ...subtitleTracks]);
        setSelectedSubtitle(hls.subtitleTrack + 1); // +1 because "Off" is at index 0
      });

      // Listen for audio tracks update (some streams load audio tracks after manifest)
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        const audioTracks = hls.audioTracks.map(track => track.name || track.lang || `Track ${track.id}`);
        if (audioTracks.length > 0) {
          setAvailableAudioTracks(audioTracks);
          setSelectedAudio(hls.audioTrack);
        }
      });

      // Listen for audio track switching
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => {
        setSelectedAudio(hls.audioTrack);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error("Network error", data);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error("Media error", data);
              hls.recoverMediaError();
              break;
            default:
              console.error("Fatal error", data);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // For Safari native HLS support
      video.src = videoUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl, loading]);

  useEffect(() => {
    // Auto-save progress every 5 seconds (more frequent for better accuracy)
    if (videoRef.current && content && profileId) {
      progressUpdateIntervalRef.current = setInterval(() => {
        saveProgress();
      }, 5000);
    }

    return () => {
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
      }
    };
  }, [content, profileId, currentTime]);

  // Save progress on critical events and before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save progress immediately when user is about to leave
      saveProgress();
    };

    const handleVisibilityChange = () => {
      // Save progress when tab becomes hidden
      if (document.hidden) {
        saveProgress();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Final save on component unmount
      saveProgress();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [content, profileId]);

  // Handle video end and auto-play next episode countdown
  useEffect(() => {
    if (!videoRef.current || !duration) return;

    const handleVideoEnd = async () => {
      // For TV shows/anime, start auto-play countdown
      if (content?.content_type !== "movie" && currentEpisode < allEpisodes.length) {
        setShowAutoPlayOverlay(true);
        setAutoPlayCountdown(5);

        // Start countdown
        let countdown = 5;
        autoPlayCountdownRef.current = setInterval(() => {
          countdown--;
          setAutoPlayCountdown(countdown);

          if (countdown === 0) {
            if (autoPlayCountdownRef.current) {
              clearInterval(autoPlayCountdownRef.current);
            }
            setShowAutoPlayOverlay(false);
            handleNextEpisode();
          }
        }, 1000);
      } else if (content?.content_type === "movie") {
        // Mark movie as watched
        await markMovieAsWatched();
      }
    };

    const video = videoRef.current;
    video.addEventListener("ended", handleVideoEnd);

    return () => {
      video.removeEventListener("ended", handleVideoEnd);
      if (autoPlayCountdownRef.current) {
        clearInterval(autoPlayCountdownRef.current);
      }
    };
  }, [content, currentEpisode, allEpisodes.length, duration]);

  // Cancel auto-play countdown handler
  const cancelAutoPlay = () => {
    if (autoPlayCountdownRef.current) {
      clearInterval(autoPlayCountdownRef.current);
    }
    setShowAutoPlayOverlay(false);
    setAutoPlayCountdown(null);
  };

  // Mark movie as watched in database
  const markMovieAsWatched = async () => {
    if (!content || !profileId || content.content_type !== "movie") return;

    try {
      await supabase.from("watched_content").upsert({
        profile_id: profileId,
        content_id: content.tmdb_id,
        content_type: "movie",
        completed_at: new Date().toISOString(),
      });

      // Also mark as completed in continue_watching
      await supabase
        .from("continue_watching")
        .update({ is_completed: true })
        .eq("profile_id", profileId)
        .eq("content_uuid", content.id);
    } catch (error) {
      console.error("Error marking movie as watched:", error);
    }
  };

  useEffect(() => {
    // Check for skip intro/credits buttons and next episode preview
    if (episode && currentTime > 0 && duration > 0) {
      if (
        episode.skip_intro_start !== null &&
        episode.skip_intro_end !== null &&
        currentTime >= episode.skip_intro_start &&
        currentTime <= episode.skip_intro_end
      ) {
        setShowSkipIntro(true);
      } else {
        setShowSkipIntro(false);
      }

      if (
        episode.skip_credits_start !== null &&
        currentTime >= episode.skip_credits_start
      ) {
        setShowSkipCredits(true);
      } else {
        setShowSkipCredits(false);
      }

      // Use completion threshold from database (in seconds)
      // completionThreshold is the position when episode is considered complete
      // For example, if threshold is 90 seconds, episode is complete when currentTime >= 90
      const shouldShowNextEpisode =
        content?.content_type !== "movie" &&
        currentEpisode < allEpisodes.length &&
        completionThreshold !== null &&
        currentTime >= completionThreshold;

      setShowNextEpisode(Boolean(shouldShowNextEpisode));
    }
  }, [currentTime, episode, duration, content, currentEpisode, allEpisodes.length, completionThreshold]);

  // Scroll to current episode when Episodes modal opens
  useEffect(() => {
    if (showEpisodes && currentEpisodeRef.current) {
      setTimeout(() => {
        currentEpisodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [showEpisodes]);

  // Auto-hide controls
  useEffect(() => {
    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
      if (playing) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };

    const handleMouseMove = () => resetControlsTimeout();
    const handleMouseLeave = () => {
      if (playing) {
        setShowControls(false);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [playing]);

  // Keyboard feedback display
  const showFeedback = (icon: React.ReactNode, text?: string) => {
    setKeyboardFeedback({ icon, text });
    setTimeout(() => setKeyboardFeedback(null), 400);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if menus or episodes sidebar is open
      if (showAudioSubtitlesMenu || showQualityMenu || showEpisodes || showUpgradeDrawer) {
        if (e.key === "Escape") {
          setShowAudioSubtitlesMenu(false);
          setShowQualityMenu(false);
          setShowEpisodes(false);
          setShowUpgradeDrawer(false);
        }
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          showFeedback(
            playing ? (
              <Pause className="w-12 h-12" strokeWidth={1.5} />
            ) : (
              <Play className="w-12 h-12" strokeWidth={1.5} />
            )
          );
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(-10);
          showFeedback(
            <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <text x="12" y="16" fontSize="8" textAnchor="middle" fill="currentColor" fontWeight="bold">10</text>
            </svg>
          );
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(10);
          showFeedback(
            <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <text x="12" y="16" fontSize="8" textAnchor="middle" fill="currentColor" fontWeight="bold">10</text>
            </svg>
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          if (videoRef.current) {
            const newVolume = Math.min(1, volume + 0.1);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            if (newVolume > 0) setMuted(false);
            showFeedback(
              <Volume2 className="w-12 h-12" strokeWidth={1.5} />,
              `${Math.round(newVolume * 100)}%`
            );
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (videoRef.current) {
            const newVolume = Math.max(0, volume - 0.1);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            if (newVolume === 0) setMuted(true);
            showFeedback(
              newVolume === 0 ? (
                <VolumeX className="w-12 h-12" strokeWidth={1.5} />
              ) : (
                <Volume2 className="w-12 h-12" strokeWidth={1.5} />
              ),
              `${Math.round(newVolume * 100)}%`
            );
          }
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          showFeedback(
            isFullscreen ? (
              <Minimize className="w-12 h-12" strokeWidth={1.5} />
            ) : (
              <Maximize className="w-12 h-12" strokeWidth={1.5} />
            )
          );
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          showFeedback(
            muted ? (
              <Volume2 className="w-12 h-12" strokeWidth={1.5} />
            ) : (
              <VolumeX className="w-12 h-12" strokeWidth={1.5} />
            )
          );
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen();
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playing, volume, muted, showAudioSubtitlesMenu, showQualityMenu, showEpisodes, showUpgradeDrawer, isFullscreen]);

  const loadPlayerData = async () => {
    try {
      setLoading(true);

      // Load content data
      const { data: contentData, error: contentError } = await supabase
        .from("content")
        .select("*")
        .eq("id", contentId)
        .single();

      if (contentError) throw contentError;
      setContent(contentData);

      const isMovie = contentData.content_type === "movie";

      // Load TMDB data for content title
      if (isMovie) {
        const { fetchMovieDetails } = await import("@/lib/tmdb");
        const tmdbData = await fetchMovieDetails(contentData.tmdb_id);
        if (tmdbData) {
          setContentTitle((tmdbData as any).title);
        }
      } else {
        const tmdbData = await fetchTVShowDetails(contentData.tmdb_id);
        if (tmdbData) {
          setContentTitle(tmdbData.name);
        }
        // Load all seasons for TV shows
        await loadAllSeasons();
      }

      // If episode ID is provided, load episode data (for TV shows)
      if (episodeId && !isMovie) {
        const { data: episodeData, error: episodeError } = await supabase
          .from("episodes")
          .select("*, seasons!inner(season_number, id)")
          .eq("id", episodeId)
          .single();

        if (episodeError) throw episodeError;
        setEpisode(episodeData);

        // Set completion threshold from database
        setCompletionThreshold(episodeData.completion_threshold || 90);

        const season = (episodeData as any).seasons;
        setSeasonData(season);
        setCurrentSeason(season.season_number);
        setCurrentEpisode(episodeData.episode_number);
        setExpandedEpisode(episodeData.episode_number);

        // Load TMDB episode details
        const tmdbEpisode = await fetchEpisodeDetails(
          contentData.tmdb_id,
          season.season_number,
          episodeData.episode_number
        );
        if (tmdbEpisode) {
          setEpisodeTitle(tmdbEpisode.name);
        }

        // Set video URL from episode data
        if (episodeData.video_url && episodeData.video_url.hls_url) {
          setVideoUrl(episodeData.video_url.hls_url);
        }

        // Load all episodes in this season
        await loadSeasonEpisodes(contentData.tmdb_id, season.season_number);

        // Load saved progress from new hybrid schema
        const { data: progressData } = await supabase
          .from("continue_watching")
          .select("current_position, current_season, current_episode, episodes_progress")
          .eq("profile_id", profileId)
          .eq("content_id", contentData.tmdb_id)
          .eq("content_type", contentData.content_type)
          .maybeSingle();

        if (progressData) {
          // Check if this specific episode has progress in JSONB
          const episodeKey = `s${String(season.season_number).padStart(2, '0')}e${String(episodeData.episode_number).padStart(2, '0')}`;
          const episodeProgress = progressData.episodes_progress?.[episodeKey];

          if (episodeProgress) {
            setSavedPosition(episodeProgress);
          } else if (progressData.current_position && season.season_number === progressData.current_season && episodeData.episode_number === progressData.current_episode) {
            setSavedPosition(progressData.current_position);
          } else {
            setSavedPosition(0);
          }
        } else {
          setSavedPosition(0);
        }
      } else if (!isMovie && seasonNumber && episodeNumber) {
        // TV show with season/episode numbers but no episode ID
        // Look up the episode using content_id, season_number, and episode_number
        const { data: seasonData, error: seasonError } = await supabase
          .from("seasons")
          .select("id, season_number")
          .eq("content_id", contentId)
          .eq("season_number", parseInt(seasonNumber))
          .single();

        if (seasonError) throw seasonError;

        const { data: episodeData, error: episodeError } = await supabase
          .from("episodes")
          .select("*")
          .eq("season_id", seasonData.id)
          .eq("episode_number", parseInt(episodeNumber))
          .single();

        if (episodeError) throw episodeError;
        setEpisode(episodeData);

        // Set completion threshold from database
        setCompletionThreshold(episodeData.completion_threshold || 90);

        setSeasonData(seasonData);
        setCurrentSeason(seasonData.season_number);
        setCurrentEpisode(episodeData.episode_number);
        setExpandedEpisode(episodeData.episode_number);

        // Load TMDB episode details
        const tmdbEpisode = await fetchEpisodeDetails(
          contentData.tmdb_id,
          seasonData.season_number,
          episodeData.episode_number
        );
        if (tmdbEpisode) {
          setEpisodeTitle(tmdbEpisode.name);
        }

        // Set video URL from episode data
        if (episodeData.video_url && episodeData.video_url.hls_url) {
          setVideoUrl(episodeData.video_url.hls_url);
        }

        // Load all episodes in this season
        await loadSeasonEpisodes(contentData.tmdb_id, seasonData.season_number);

        // Load saved progress from new hybrid schema
        const { data: progressData } = await supabase
          .from("continue_watching")
          .select("current_position, current_season, current_episode, episodes_progress")
          .eq("profile_id", profileId)
          .eq("content_id", contentData.tmdb_id)
          .eq("content_type", contentData.content_type)
          .maybeSingle();

        if (progressData) {
          // Check if this specific episode has progress in JSONB
          const episodeKey = `s${String(seasonData.season_number).padStart(2, '0')}e${String(episodeData.episode_number).padStart(2, '0')}`;
          const episodeProgress = progressData.episodes_progress?.[episodeKey];

          if (episodeProgress) {
            setSavedPosition(episodeProgress);
          } else if (progressData.current_position && seasonData.season_number === progressData.current_season && episodeData.episode_number === progressData.current_episode) {
            setSavedPosition(progressData.current_position);
          } else {
            setSavedPosition(0);
          }
        } else {
          setSavedPosition(0);
        }
      } else if (isMovie) {
        // Set completion threshold from database for movies
        setCompletionThreshold(contentData.completion_threshold || 120);

        // Set video URL from content data
        if (contentData.video_url && contentData.video_url.hls_url) {
          setVideoUrl(contentData.video_url.hls_url);
        }

        // Load saved progress for movie from new hybrid schema
        const { data: progressData } = await supabase
          .from("continue_watching")
          .select("last_position, is_completed")
          .eq("profile_id", profileId)
          .eq("content_id", contentData.tmdb_id)
          .eq("content_type", "movie")
          .maybeSingle();

        if (progressData && !progressData.is_completed) {
          setSavedPosition(progressData.last_position);
        } else {
          setSavedPosition(0);
        }
      }
    } catch (error) {
      console.error("Error loading player data:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const loadAllSeasons = async () => {
    if (!contentId) return;

    try {
      const { data: seasons, error } = await supabase
        .from("seasons")
        .select("id, season_number")
        .eq("content_id", contentId)
        .order("season_number", { ascending: true });

      if (!error && seasons) {
        setAllSeasons(seasons);
      }
    } catch (error) {
      console.error("Error loading seasons:", error);
    }
  };

  const loadSeasonEpisodes = async (tmdbId: number, seasonNum: number) => {
    try {
      const seasonDetails = await fetchSeasonDetails(tmdbId, seasonNum);
      if (seasonDetails && (seasonDetails as any).episodes) {
        setAllEpisodes((seasonDetails as any).episodes);
      }

      // Load episode progress from new JSONB structure
      const { data: continueWatchingData } = await supabase
        .from("continue_watching")
        .select("episodes_progress, current_season, current_episode, current_position, duration")
        .eq("profile_id", profileId)
        .eq("content_id", contentId)
        .maybeSingle();

      const progressMap = new Map<string, number>();

      if (continueWatchingData) {
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

        // Also add current episode if it has progress
        if (continueWatchingData.current_season && continueWatchingData.current_episode && continueWatchingData.current_position && continueWatchingData.duration) {
          const episodeKey = `S${continueWatchingData.current_season}E${continueWatchingData.current_episode}`;
          const progress = (continueWatchingData.current_position / continueWatchingData.duration) * 100;
          progressMap.set(episodeKey, progress);
        }
      }

      // Load watched episodes (these are 100% complete)
      const { data: watchedEpisodes } = await supabase
        .from("watched_episodes")
        .select("season_number, episode_number")
        .eq("profile_id", profileId)
        .eq("content_id", contentId);

      if (watchedEpisodes) {
        watchedEpisodes.forEach((ep: any) => {
          const episodeKey = `S${ep.season_number}E${ep.episode_number}`;
          progressMap.set(episodeKey, 100);
        });
      }

      setEpisodeProgress(progressMap);
    } catch (error) {
      console.error("Error loading season episodes:", error);
    }
  };

  const saveProgress = async () => {
    if (!content || !profileId || !videoRef.current) return;

    const position = Math.floor(videoRef.current.currentTime);
    const totalDuration = Math.floor(videoRef.current.duration);

    if (!position || !totalDuration) return;

    try {
      // Use completion threshold from database (already loaded in state)
      // completionThreshold is the position (in seconds) when content is considered complete
      const thresholdValue = completionThreshold || (content.content_type === "movie" ? 120 : 90);

      if (content.content_type === "movie") {
        // For movies - call PostgreSQL function
        await supabase.rpc("save_movie_progress", {
          p_profile_id: profileId,
          p_content_id: content.tmdb_id,
          p_content_uuid: content.id,
          p_position: position,
          p_duration: totalDuration,
          p_title: contentTitle,
          p_thumbnail: "",
          p_completion_threshold: thresholdValue,
        });
      } else if (episodeId && episode && seasonData) {
        // For TV shows/anime - call PostgreSQL function
        await supabase.rpc("save_tv_progress", {
          p_profile_id: profileId,
          p_content_id: content.tmdb_id,
          p_content_uuid: content.id,
          p_episode_id: episodeId,
          p_season: currentSeason,
          p_episode: currentEpisode,
          p_position: position,
          p_duration: totalDuration,
          p_title: contentTitle,
          p_thumbnail: "",
          p_completion_threshold: thresholdValue,
        });

        // Also update watched_episodes table if completed (using database threshold)
        const isCompleted = position >= thresholdValue;
        if (isCompleted) {
          await supabase.from("watched_episodes").upsert({
            profile_id: profileId,
            content_id: content.id,
            episode_id: episodeId,
            season_number: currentSeason,
            episode_number: currentEpisode,
          });
        }
      } else if (!episodeId && seasonNumber && episodeNumber) {
        // For TV shows using season/episode params - we need episode_id
        // Try to get episode_id first
        const { data: episodeData } = await supabase
          .from("episodes")
          .select("id")
          .eq("season_id", seasonData?.id)
          .eq("episode_number", currentEpisode)
          .single();

        if (episodeData) {
          await supabase.rpc("save_tv_progress", {
            p_profile_id: profileId,
            p_content_id: content.tmdb_id,
            p_content_uuid: content.id,
            p_episode_id: episodeData.id,
            p_season: currentSeason,
            p_episode: currentEpisode,
            p_position: position,
            p_duration: totalDuration,
            p_title: contentTitle,
            p_thumbnail: "",
            p_completion_threshold: thresholdValue,
          });

          // Also update watched_episodes table if completed (using database threshold)
          const isCompleted = position >= thresholdValue;
          if (isCompleted) {
            await supabase.from("watched_episodes").upsert({
              profile_id: profileId,
              content_id: content.id,
              episode_id: episodeData.id,
              season_number: currentSeason,
              episode_number: currentEpisode,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error saving progress:", error);
    }
  };

  const handleBack = async () => {
    await saveProgress();
    // Navigate to homepage with content modal opened
    if (contentId) {
      router.push(`/?content=${contentId}`);
    } else {
      router.push("/");
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
        // Save progress immediately when pausing
        saveProgress();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);

      // Update buffered
      if (videoRef.current.buffered.length > 0) {
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setBuffered((bufferedEnd / videoRef.current.duration) * 100);
      }
    }
  };

  const handleLoadedMetadata = async () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);

      // Apply saved position if available
      if (savedPosition !== null && savedPosition > 0) {
        videoRef.current.currentTime = savedPosition;
      }

      // Autoplay the video with muted first (browsers allow muted autoplay)
      try {
        videoRef.current.muted = true;
        await videoRef.current.play();
        setPlaying(true);

        // Unmute after a short delay
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.muted = false;
            setMuted(false);
          }
        }, 100);
      } catch (error) {
        console.error("Autoplay failed:", error);
        // Autoplay might be blocked by browser, user will need to click play
        if (videoRef.current) {
          videoRef.current.muted = false;
        }
      }
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const bounds = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - bounds.left) / bounds.width;
      videoRef.current.currentTime = percent * videoRef.current.duration;
      // Save progress immediately after seeking
      setTimeout(() => saveProgress(), 500);
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
      // Save progress after skipping
      setTimeout(() => saveProgress(), 500);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      if (newVolume === 0) {
        setMuted(true);
      } else {
        setMuted(false);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const skipIntro = () => {
    if (videoRef.current && episode?.skip_intro_end) {
      videoRef.current.currentTime = episode.skip_intro_end;
      setShowSkipIntro(false);
    }
  };

  const skipCredits = () => {
    // Go to next episode
    handleNextEpisode();
  };

  const handleNextEpisode = async () => {
    if (!content || content.content_type === "movie") return;

    // Save progress before switching episodes
    await saveProgress();

    const nextEpisodeNum = currentEpisode + 1;
    const nextEpisode = allEpisodes.find((ep) => ep.episode_number === nextEpisodeNum);

    if (nextEpisode) {
      // Find episode ID from database
      const { data: episodeData } = await supabase
        .from("episodes")
        .select("id")
        .eq("season_id", seasonData?.id)
        .eq("episode_number", nextEpisodeNum)
        .single();

      if (episodeData) {
        const params = new URLSearchParams({
          profile_id: profileId!,
          content_id: contentId!,
          episode_id: episodeData.id,
          season_number: currentSeason.toString(),
          episode_number: nextEpisodeNum.toString(),
        });

        router.push(`/player?${params.toString()}`);
      }
    }
  };

  const handleSeasonSwitch = async (seasonNum: number) => {
    setShowSeasonSelector(false);

    if (!content || seasonNum === currentSeason) {
      return;
    }

    setCurrentSeason(seasonNum);

    // Load episodes for the new season
    await loadSeasonEpisodes(content.tmdb_id, seasonNum);
  };

  const handleEpisodeClick = async (episodeNum: number) => {
    // Save progress before switching episodes
    await saveProgress();

    // Find episode ID from database
    const { data: episodeData } = await supabase
      .from("episodes")
      .select("id")
      .eq("season_id", seasonData?.id)
      .eq("episode_number", episodeNum)
      .single();

    if (episodeData) {
      const params = new URLSearchParams({
        profile_id: profileId!,
        content_id: contentId!,
        episode_id: episodeData.id,
        season_number: currentSeason.toString(),
        episode_number: episodeNum.toString(),
      });

      router.push(`/player?${params.toString()}`);
      setShowEpisodes(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading player...</div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-white text-xl">Video source not available</div>
        <Button onClick={handleBack} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlay}
      />

      {/* Top Overlay - Back Button and Title */}
      <div
        className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-4 pb-24 px-12 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-3 text-white hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-8 h-8" />
          </button>
        </div>
      </div>

      {/* Skip Intro Button - Bottom Left */}
      {showSkipIntro && (
        <div className="absolute bottom-32 left-12 z-50">
          <button
            onClick={skipIntro}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-8 py-3 rounded-sm text-lg font-semibold transition-all duration-200 border border-white/40"
          >
            Skip Intro
          </button>
        </div>
      )}

      {/* Skip Credits / Next Episode Button */}
      {showSkipCredits && (
        <div className="absolute bottom-32 right-12 z-50">
          <button
            onClick={skipCredits}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-8 py-3 rounded-sm text-lg font-semibold transition-all duration-200 border border-white/40"
          >
            Next Episode
          </button>
        </div>
      )}

      {/* Next Episode Button - Shows when completion threshold is reached */}
      {showNextEpisode && !showSkipCredits && content?.content_type !== "movie" && currentEpisode < allEpisodes.length && (
        <div className="absolute bottom-32 right-12 z-50">
          <button
            onClick={handleNextEpisode}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-8 py-3 rounded-sm text-lg font-semibold transition-all duration-200 border border-white/40"
          >
            Next Episode
          </button>
        </div>
      )}

      {/* Auto-Play Next Episode Overlay */}
      {showAutoPlayOverlay && allEpisodes[currentEpisode] && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#181818] rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
            {/* Next Episode Info */}
            <div className="mb-6">
              <h3 className="text-white text-xl font-semibold mb-2">Next Episode</h3>
              <div className="flex items-start gap-3">
                <span className="text-white text-lg font-bold">{allEpisodes[currentEpisode].episode_number}</span>
                <div className="flex-1">
                  <h4 className="text-white font-semibold">{allEpisodes[currentEpisode].name}</h4>
                  {allEpisodes[currentEpisode].runtime && (
                    <span className="text-gray-400 text-sm">{allEpisodes[currentEpisode].runtime}m</span>
                  )}
                </div>
              </div>
            </div>

            {/* Countdown */}
            <div className="mb-6 text-center">
              <div className="text-6xl font-bold text-white mb-2">{autoPlayCountdown}</div>
              <p className="text-gray-400">Playing next episode...</p>
            </div>

            {/* Cancel Button */}
            <button
              onClick={cancelAutoPlay}
              className="w-full bg-white hover:bg-gray-200 text-black font-semibold py-3 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Feedback Display */}
      {keyboardFeedback && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          {keyboardFeedback.text ? (
            // Volume with percentage - rounded rectangle
            <div className="bg-black/60 backdrop-blur-sm text-white/90 px-6 py-4 rounded-full shadow-lg border border-white/10 animate-in fade-in duration-100">
              <div className="flex flex-col items-center gap-2">
                <div className="text-white/90 opacity-80">
                  {keyboardFeedback.icon}
                </div>
                <div className="text-base font-medium opacity-90">
                  {keyboardFeedback.text}
                </div>
              </div>
            </div>
          ) : (
            // Other controls - perfect circle
            <div className="bg-black/60 backdrop-blur-sm text-white/90 p-6 rounded-full shadow-lg border border-white/10 animate-in fade-in duration-100">
              <div className="text-white/90 opacity-80">
                {keyboardFeedback.icon}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/60 to-transparent pt-24 pb-4 px-12 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Progress Bar */}
        <div className="mb-4">
          <div
            onClick={handleProgressClick}
            className="group relative w-full h-1 bg-gray-600 rounded-full cursor-pointer hover:h-2 transition-all duration-200"
          >
            {/* Buffered */}
            <div
              className="absolute h-full bg-gray-500 rounded-full transition-all"
              style={{ width: `${buffered}%` }}
            />
            {/* Progress */}
            <div
              className="absolute h-full bg-red-600 rounded-full transition-all group-hover:bg-red-500"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-6">
          {/* Left Controls */}
          <div className="flex items-center gap-6">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-gray-300 transition-all duration-200 hover:scale-125"
            >
              {playing ? (
                <Pause className="w-11 h-11" fill="white" />
              ) : (
                <Play className="w-11 h-11" fill="white" />
              )}
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => skip(-10)}
              className="text-white hover:text-gray-300 transition-all duration-200 hover:scale-110 relative"
            >
              <svg
                className="w-11 h-11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">
                10
              </span>
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => skip(10)}
              className="text-white hover:text-gray-300 transition-all duration-200 hover:scale-110 relative"
            >
              <svg
                className="w-11 h-11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">
                10
              </span>
            </button>

            {/* Volume */}
            <div
              className="flex items-center gap-3 group"
              onMouseEnter={() => setVolumeHovered(true)}
              onMouseLeave={() => setVolumeHovered(false)}
            >
              <button
                onClick={toggleMute}
                className="text-white hover:text-gray-300 transition-all duration-200 hover:scale-125"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-10 h-10" />
                ) : (
                  <Volume2 className="w-10 h-10" />
                )}
              </button>
              <div className="relative w-0 group-hover:w-28 transition-all duration-200 h-1">
                {/* Volume track */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gray-600 rounded-full overflow-hidden">
                  {/* Volume fill */}
                  <div
                    className="h-full bg-red-600 rounded-full"
                    style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                  />
                  {/* Volume dot - only show on hover */}
                  {volumeHovered && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full"
                      style={{ left: `calc(${(muted ? 0 : volume) * 100}% - 6px)` }}
                    />
                  )}
                </div>
                {/* Invisible input for interaction */}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Time */}
            <div className="text-white text-base font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Center - Episode Info */}
          <div className="flex-1 text-center">
            <div className="text-white text-base font-medium">
              {content?.content_type !== "movie" && (
                <>
                  {contentTitle} S{currentSeason}:E{currentEpisode} {episodeTitle}
                </>
              )}
              {content?.content_type === "movie" && <>{contentTitle}</>}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-6">
            {/* Next Episode - Always show in controls */}
            {content?.content_type !== "movie" && currentEpisode < allEpisodes.length && (
              <div
                className="relative"
                onMouseEnter={() => {
                  // Add delay before showing preview
                  nextEpisodeHoverTimeoutRef.current = setTimeout(() => {
                    setShowNextEpisodeHover(true);
                  }, 300);
                }}
                onMouseLeave={() => {
                  // Clear timeout if leaving before delay completes
                  if (nextEpisodeHoverTimeoutRef.current) {
                    clearTimeout(nextEpisodeHoverTimeoutRef.current);
                  }
                  setShowNextEpisodeHover(false);
                }}
              >
                <button
                  onClick={handleNextEpisode}
                  className="text-white hover:text-gray-300 transition-all duration-200 hover:scale-125"
                  title="Next Episode"
                >
                  <SkipForward className="w-10 h-10" />
                </button>
              </div>
            )}

            {/* Episodes List */}
            {content?.content_type !== "movie" && (
              <button
                onClick={() => setShowEpisodes(!showEpisodes)}
                className="text-white hover:text-gray-300 transition-all duration-200 hover:scale-125"
                title="Episodes"
              >
                <List className="w-10 h-10" />
              </button>
            )}

            {/* Episodes Sidebar */}
            {showEpisodes && (
              <div
                className="fixed inset-0 bg-black/70 z-50"
                onClick={() => setShowEpisodes(false)}
              >
                <div
                  className="absolute top-0 right-0 h-full w-full max-w-md bg-[#181818] shadow-2xl border-l border-gray-700 overflow-hidden flex flex-col animate-in slide-in-from-right duration-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
                    <button
                      onClick={() => setShowSeasonSelector(!showSeasonSelector)}
                      className="text-white text-xl font-bold hover:text-gray-300 transition-colors"
                    >
                      {showSeasonSelector ? 'Select Season' : `Season ${currentSeason}`}
                    </button>
                    <button
                      onClick={() => setShowEpisodes(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Content Area - Seasons or Episodes */}
                  <div className="flex-1 overflow-y-auto">
                    {showSeasonSelector ? (
                      // Season Grid View
                      <div className="p-4 grid grid-cols-3 gap-3">
                        {allSeasons.map((season) => (
                          <button
                            key={season.id}
                            onClick={() => handleSeasonSwitch(season.season_number)}
                            className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${
                              season.season_number === currentSeason
                                ? 'border-red-600 bg-red-600/20 text-white'
                                : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                            }`}
                          >
                            <div className="text-center">
                              <div className="text-sm text-gray-400">Season</div>
                              <div className="text-2xl font-bold">{season.season_number}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      // Episodes List - All Expanded
                      <div className="p-4 space-y-3">
                        {allEpisodes.map((ep) => {
                          const episodeKey = `S${currentSeason}E${ep.episode_number}`;
                          const progress = episodeProgress.get(episodeKey) || 0;
                          const isCurrent = ep.episode_number === currentEpisode;

                          return (
                            <div
                              key={ep.id}
                              ref={isCurrent ? currentEpisodeRef : null}
                              onClick={() => {
                                if (isCurrent) return;
                                handleEpisodeClick(ep.episode_number);
                              }}
                              className={`border rounded-lg overflow-hidden transition-all ${
                                isCurrent
                                  ? 'border-red-600 bg-red-600/10 cursor-default'
                                  : 'border-gray-700 bg-[#1a1a1a] hover:bg-[#1f1f1f] cursor-pointer'
                              }`}
                            >
                              <div className="p-3">
                                <div className="flex gap-3 items-start mb-2">
                                  <span className="text-white text-lg font-bold">{ep.episode_number}</span>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-semibold text-sm truncate">{ep.name}</h3>
                                    {ep.runtime && (
                                      <span className="text-gray-400 text-xs">{ep.runtime}m</span>
                                    )}
                                  </div>
                                </div>

                                {/* Thumbnail */}
                                <div className="relative w-full aspect-video rounded overflow-hidden bg-gray-800 mb-2">
                                  {ep.still_path ? (
                                    <Image
                                      src={getTMDBImageUrl(ep.still_path, "w500")}
                                      alt={ep.name}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-gray-600 text-xs">No image</span>
                                    </div>
                                  )}

                                  {/* Progress Bar */}
                                  {progress > 0 && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/80">
                                      <div
                                        className="h-full bg-red-600"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                  )}

                                  {/* Play Button Overlay */}
                                  {!isCurrent && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                      <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center">
                                        <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Description */}
                                <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                                  {ep.overview}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Audio & Subtitles */}
            <button
              onClick={() => setShowAudioSubtitlesMenu(!showAudioSubtitlesMenu)}
              className="text-white hover:text-gray-300 transition-all duration-200 hover:scale-125"
              title="Audio & Subtitles"
            >
              <AudioLines className="w-10 h-10" />
            </button>

            {/* Audio & Subtitles Menu - Centered */}
            {showAudioSubtitlesMenu && (
              <div
                className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                onClick={() => setShowAudioSubtitlesMenu(false)}
              >
                <div
                  className="bg-[#181818] rounded-lg w-full max-w-2xl max-h-[500px] overflow-hidden shadow-2xl border border-gray-700"
                  onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-4 border-b border-gray-800">
                      <h2 className="text-white text-lg font-semibold">Audio & Subtitles</h2>
                      <button
                        onClick={() => setShowAudioSubtitlesMenu(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[400px]">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Audio Section */}
                        <div>
                          <h3 className="text-white text-base font-semibold mb-3 pb-2 border-b border-gray-700">
                            Audio
                          </h3>
                          <div className="space-y-1">
                            {availableAudioTracks.length > 0 ? (
                              availableAudioTracks.map((track, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    if (hlsRef.current) {
                                      hlsRef.current.audioTrack = index;
                                      setSelectedAudio(index);
                                    }
                                  }}
                                  className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 rounded-lg transition-colors"
                                >
                                  <span className="text-white text-sm">{track}</span>
                                  {selectedAudio === index && (
                                    <Check className="w-4 h-4 text-white" />
                                  )}
                                </button>
                              ))
                            ) : (
                              <p className="text-gray-400 text-sm p-3">No audio tracks available</p>
                            )}
                          </div>
                        </div>

                        {/* Subtitles Section */}
                        <div>
                          <h3 className="text-white text-base font-semibold mb-3 pb-2 border-b border-gray-700">
                            Subtitles
                          </h3>
                          <div className="space-y-1">
                            {availableSubtitles.length > 0 ? (
                              availableSubtitles.map((subtitle, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    if (hlsRef.current) {
                                      hlsRef.current.subtitleTrack = index - 1;
                                      setSelectedSubtitle(index);
                                    }
                                  }}
                                  className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 rounded-lg transition-colors"
                                >
                                  <span className="text-white text-sm">{subtitle}</span>
                                  {selectedSubtitle === index && (
                                    <Check className="w-4 h-4 text-white" />
                                  )}
                                </button>
                              ))
                            ) : (
                              <p className="text-gray-400 text-sm p-3">No subtitles available</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Quality */}
            <button
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              className="text-white hover:text-gray-300 transition-all duration-200 hover:scale-125"
              title="Quality"
            >
              <div className="px-3 py-2 bg-black/50 backdrop-blur-sm rounded border border-white/30 text-sm font-bold">
                {currentQualityLabel}
              </div>
            </button>

            {/* Quality Menu - Centered */}
            {showQualityMenu && (
              <div
                className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                onClick={() => setShowQualityMenu(false)}
              >
                <div
                  className="bg-[#181818] rounded-lg w-full max-w-md max-h-[500px] overflow-hidden shadow-2xl border border-gray-700"
                  onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-4 border-b border-gray-800">
                      <h2 className="text-white text-lg font-semibold">Quality</h2>
                      <button
                        onClick={() => setShowQualityMenu(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[400px] space-y-1">
                      {getAvailableQualities(plan).map((qualityOption, index) => {
                        const isLocked = qualityOption.locked;
                        const requiredPlan = isLocked ? getRequiredPlanForQuality(qualityOption.value) : null;

                        return (
                          <button
                            key={index}
                            onClick={() => {
                              if (isLocked && requiredPlan) {
                                setRequiredPlanForUpgrade(requiredPlan);
                                setShowUpgradeDrawer(true);
                                setShowQualityMenu(false);
                              } else if (hlsRef.current && index > 0) {
                                hlsRef.current.currentLevel = index - 1;
                                setSelectedQuality(index);
                                // Update quality label (extract just the quality part like "HD", "SD", "FHD")
                                const labelMatch = qualityOption.value.match(/(\d+)p/);
                                if (labelMatch) {
                                  const quality = parseInt(labelMatch[1]);
                                  if (quality >= 1080) setCurrentQualityLabel("FHD");
                                  else if (quality >= 720) setCurrentQualityLabel("HD");
                                  else setCurrentQualityLabel("SD");
                                }
                              } else if (index === 0) {
                                // Auto quality
                                if (hlsRef.current) {
                                  hlsRef.current.currentLevel = -1;
                                  setSelectedQuality(0);
                                  setCurrentQualityLabel("Auto");
                                }
                              }
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                              isLocked ? 'opacity-60' : 'hover:bg-gray-800/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-white text-sm">{qualityOption.label}</span>
                              {isLocked && (
                                <Lock className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                            {!isLocked && selectedQuality === index && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                            {isLocked && (
                              <span className="text-xs text-yellow-500 font-medium">
                                Upgrade Required
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-gray-300 transition-all duration-200 hover:scale-125"
              title="Fullscreen"
            >
              {isFullscreen ? (
                <Minimize className="w-10 h-10" />
              ) : (
                <Maximize className="w-10 h-10" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Next Episode Preview */}
      {showNextEpisodeHover && content?.content_type !== "movie" && allEpisodes[currentEpisode] && (
        <div className="fixed bottom-20 right-12 z-50 w-[400px] pointer-events-auto">
          <div className="bg-[#181818] rounded-lg overflow-hidden shadow-2xl border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-800">
              <h3 className="text-white text-sm font-semibold">Next Episode</h3>
              <button
                onClick={() => setShowNextEpisode(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div
              onClick={handleNextEpisode}
              className="cursor-pointer hover:bg-[#1f1f1f] transition-colors"
              onMouseEnter={() => {
                // Keep preview open when hovering over it
                if (nextEpisodeHoverTimeoutRef.current) {
                  clearTimeout(nextEpisodeHoverTimeoutRef.current);
                }
                setShowNextEpisodeHover(true);
              }}
              onMouseLeave={() => {
                // Close preview when mouse leaves
                setShowNextEpisodeHover(false);
              }}
            >
                {/* Thumbnail */}
                <div className="relative w-full aspect-video bg-gray-800">
                  {allEpisodes[currentEpisode].still_path ? (
                    <Image
                      src={getTMDBImageUrl(allEpisodes[currentEpisode].still_path, "w500")}
                      alt={allEpisodes[currentEpisode].name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-gray-600">No image</span>
                    </div>
                  )}

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full border-2 border-white flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" fill="white" />
                    </div>
                  </div>
                </div>

                {/* Episode Info */}
                <div className="p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-white text-base font-bold">
                      {allEpisodes[currentEpisode].episode_number}
                    </span>
                    <div className="flex-1">
                      <h4 className="text-white font-semibold text-sm">
                        {allEpisodes[currentEpisode].name}
                      </h4>
                      {allEpisodes[currentEpisode].runtime && (
                        <span className="text-[#d2d2d2] text-xs">
                          {allEpisodes[currentEpisode].runtime}m
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[#d2d2d2] text-xs line-clamp-2">
                    {allEpisodes[currentEpisode].overview}
                  </p>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Upgrade Drawer */}
      <UpgradeDrawer
        isOpen={showUpgradeDrawer}
        onClose={() => setShowUpgradeDrawer(false)}
        currentPlan={plan}
        requiredPlan={requiredPlanForUpgrade}
      />
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading player...</div>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}
