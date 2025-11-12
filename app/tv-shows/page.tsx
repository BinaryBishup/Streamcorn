"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { FeaturedSlider } from "@/components/content/featured-slider";
import { ContentRow } from "@/components/content/content-row";
import { ContentDetailsModal } from "@/components/content/content-details-modal";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { fetchTVShowDetails, getTMDBImageUrl, TV_GENRES, fetchMultipleTVShows } from "@/lib/tmdb";

interface Content {
  id: string;
  tmdb_id: number;
  content_type: string;
  platform_id: string;
  is_featured: boolean;
}

interface TVShowWithMetadata {
  id: string;
  tmdbId: number;
  title: string;
  overview?: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating?: number;
  type: "movie" | "tv" | "anime";
  genreIds?: number[];
}

const GENRE_SECTIONS = [
  { title: "Drama Series", genreId: TV_GENRES.DRAMA },
  { title: "Crime Shows", genreId: TV_GENRES.CRIME },
  { title: "Action & Adventure", genreId: TV_GENRES.ACTION_ADVENTURE },
  { title: "Comedy Shows", genreId: TV_GENRES.COMEDY },
  { title: "Sci-Fi & Fantasy", genreId: TV_GENRES.SCI_FI_FANTASY },
  { title: "Mystery Series", genreId: TV_GENRES.MYSTERY },
  { title: "Documentaries", genreId: TV_GENRES.DOCUMENTARY },
  { title: "Animated Series", genreId: TV_GENRES.ANIMATION },
];

function TVShowsPageContent() {
  const [loading, setLoading] = useState(true);
  const [featuredShows, setFeaturedShows] = useState<TVShowWithMetadata[]>([]);
  const [genreSections, setGenreSections] = useState<{ title: string; items: TVShowWithMetadata[] }[]>([]);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const selectedPlatform = searchParams.get("platform");
  const contentId = searchParams.get("content");

  useEffect(() => {
    // Show modal if content ID is in URL
    if (contentId) {
      setSelectedContentId(contentId);
    } else {
      setSelectedContentId(null);
    }
  }, [contentId]);

  useEffect(() => {
    checkAuthAndLoadContent();
  }, [selectedPlatform]);

  const checkAuthAndLoadContent = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const selectedProfile = localStorage.getItem("selectedProfile");
      if (!selectedProfile) {
        router.push("/profiles");
        return;
      }

      await loadTVShows();
    } catch (error) {
      console.error("Error checking auth:", error);
      router.push("/auth");
    }
  };

  const loadTVShows = async () => {
    try {
      setLoading(true);

      // Load featured TV shows
      let featuredQuery = supabase
        .from("content")
        .select("*")
        .eq("content_type", "tv")
        .eq("is_featured", true)
        .limit(5);

      if (selectedPlatform) {
        featuredQuery = featuredQuery.eq("platform_id", selectedPlatform);
      }

      const { data: featuredData } = await featuredQuery;

      if (featuredData && featuredData.length > 0) {
        // PERFORMANCE: Batch fetch all featured TV shows in parallel
        const featuredIds = featuredData.map(c => c.tmdb_id);
        const tmdbDataMap = await fetchMultipleTVShows(featuredIds, true);

        const featuredWithMetadata = featuredData.map((content: Content) => {
          const tmdbData = tmdbDataMap.get(content.tmdb_id);
          return {
            id: content.id,
            tmdbId: content.tmdb_id,
            title: tmdbData?.name || `TV Show ${content.tmdb_id}`,
            overview: tmdbData?.overview,
            posterPath: getTMDBImageUrl(tmdbData?.poster_path || null, "w500") || null,
            backdropPath: getTMDBImageUrl(tmdbData?.backdrop_path || null, "w780") || null,
            rating: tmdbData?.vote_average || 0,
            type: "tv" as const,
            trailerKey: tmdbData?.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube")?.key,
          };
        });
        setFeaturedShows(featuredWithMetadata);
      }

      // Load all TV shows
      let query = supabase
        .from("content")
        .select("*")
        .eq("content_type", "tv")
        .order("created_at", { ascending: false });

      if (selectedPlatform) {
        query = query.eq("platform_id", selectedPlatform);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // PERFORMANCE: Batch fetch all TV shows TMDB metadata in parallel
        const tvShowIds = data.map(c => c.tmdb_id);
        const tmdbDataMap = await fetchMultipleTVShows(tvShowIds, false);

        const tvShowsWithMetadata = data.map((content: Content) => {
          const tmdbData = tmdbDataMap.get(content.tmdb_id);
          return {
            id: content.id,
            tmdbId: content.tmdb_id,
            title: tmdbData?.name || `TV Show ${content.tmdb_id}`,
            posterPath: getTMDBImageUrl(tmdbData?.poster_path || null, "w500") || null,
            backdropPath: getTMDBImageUrl(tmdbData?.backdrop_path || null, "w780") || null,
            rating: tmdbData?.vote_average || 0,
            type: "tv" as const,
            genreIds: tmdbData?.genre_ids || tmdbData?.genres?.map(g => g.id) || [],
          };
        });

        // Organize TV shows by genre
        const genreShows = GENRE_SECTIONS.map(section => {
          const filteredShows = tvShowsWithMetadata.filter(show =>
            show.genreIds?.includes(section.genreId)
          ).slice(0, 15);

          return {
            title: section.title,
            items: filteredShows,
          };
        }).filter(section => section.items.length > 0);

        setGenreSections(genreShows);
      }
    } catch (error) {
      console.error("Error loading TV shows:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleContentClick = (item: TVShowWithMetadata) => {
    // Update URL with content ID
    const params = new URLSearchParams(searchParams.toString());
    params.set("content", item.id);
    router.push(`/tv-shows?${params.toString()}`, { scroll: false });
  };

  const handleCloseModal = () => {
    // Remove content ID from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("content");
    router.push(`/tv-shows?${params.toString()}`, { scroll: false });
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <div className="relative">
        {/* Featured Slider */}
        {featuredShows.length > 0 && (
          <div className="relative -mt-20">
            <FeaturedSlider items={featuredShows} />
          </div>
        )}

        {/* Genre-based Content Rows */}
        <div className="relative bg-black pt-4 pb-8">
          {genreSections.length > 0 ? (
            genreSections.map((section, index) => (
              <ContentRow
                key={index}
                title={section.title}
                items={section.items}
                onItemClick={handleContentClick}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <p className="text-2xl text-gray-400 mb-2">No TV shows found</p>
              {selectedPlatform && (
                <p className="text-gray-500">
                  Try removing the platform filter
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content Details Modal */}
      {selectedContentId && (
        <ContentDetailsModal
          contentId={selectedContentId}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

export default function TVShowsPage() {
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <TVShowsPageContent />
    </Suspense>
  );
}
