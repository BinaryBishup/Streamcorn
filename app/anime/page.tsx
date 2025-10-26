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

interface AnimeWithMetadata {
  id: string;
  tmdbId: number;
  title: string;
  overview?: string;
  posterPath: string | null;
  backdropPath?: string | null;
  rating?: number;
  type: "movie" | "tv" | "anime";
  genreIds?: number[];
}

const GENRE_SECTIONS = [
  { title: "Action & Adventure Anime", genreId: TV_GENRES.ACTION_ADVENTURE },
  { title: "Animated Series", genreId: TV_GENRES.ANIMATION },
  { title: "Sci-Fi & Fantasy Anime", genreId: TV_GENRES.SCI_FI_FANTASY },
  { title: "Comedy Anime", genreId: TV_GENRES.COMEDY },
  { title: "Drama Anime", genreId: TV_GENRES.DRAMA },
  { title: "Mystery Anime", genreId: TV_GENRES.MYSTERY },
];

function AnimePageContent() {
  const [loading, setLoading] = useState(true);
  const [featuredAnime, setFeaturedAnime] = useState<AnimeWithMetadata[]>([]);
  const [genreSections, setGenreSections] = useState<{ title: string; items: AnimeWithMetadata[] }[]>([]);
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

      await loadAnime();
    } catch (error) {
      console.error("Error checking auth:", error);
      router.push("/auth");
    }
  };

  const loadAnime = async () => {
    try {
      setLoading(true);

      // Load featured anime
      let featuredQuery = supabase
        .from("content")
        .select("*")
        .eq("content_type", "anime")
        .eq("is_featured", true)
        .limit(5);

      if (selectedPlatform) {
        featuredQuery = featuredQuery.eq("platform_id", selectedPlatform);
      }

      const { data: featuredData } = await featuredQuery;

      if (featuredData && featuredData.length > 0) {
        // PERFORMANCE: Batch fetch all featured anime in parallel
        const featuredIds = featuredData.map(c => c.tmdb_id);
        const tmdbDataMap = await fetchMultipleTVShows(featuredIds, true);

        const featuredWithMetadata = featuredData.map((content: Content) => {
          const tmdbData = tmdbDataMap.get(content.tmdb_id);
          return {
            id: content.id,
            tmdbId: content.tmdb_id,
            title: tmdbData?.name || `Anime ${content.tmdb_id}`,
            overview: tmdbData?.overview,
            posterPath: getTMDBImageUrl(tmdbData?.poster_path || null, "w500"),
            backdropPath: getTMDBImageUrl(tmdbData?.backdrop_path || null, "w780"),
            rating: tmdbData?.vote_average || 0,
            type: "anime" as const,
            trailerKey: tmdbData?.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube")?.key,
          };
        });
        setFeaturedAnime(featuredWithMetadata);
      }

      // Load all anime
      let query = supabase
        .from("content")
        .select("*")
        .eq("content_type", "anime")
        .order("created_at", { ascending: false });

      if (selectedPlatform) {
        query = query.eq("platform_id", selectedPlatform);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // PERFORMANCE: Batch fetch all anime TMDB metadata in parallel
        const animeIds = data.map(c => c.tmdb_id);
        const tmdbDataMap = await fetchMultipleTVShows(animeIds, false);

        const animeWithMetadata = data.map((content: Content) => {
          const tmdbData = tmdbDataMap.get(content.tmdb_id);
          return {
            id: content.id,
            tmdbId: content.tmdb_id,
            title: tmdbData?.name || `Anime ${content.tmdb_id}`,
            posterPath: getTMDBImageUrl(tmdbData?.poster_path || null, "w500"),
            backdropPath: getTMDBImageUrl(tmdbData?.backdrop_path || null, "w780"),
            rating: tmdbData?.vote_average || 0,
            type: "anime" as const,
            genreIds: tmdbData?.genre_ids || tmdbData?.genres?.map(g => g.id) || [],
          };
        });

        // Organize anime by genre
        const genreAnime = GENRE_SECTIONS.map(section => {
          const filteredAnime = animeWithMetadata.filter(anime =>
            anime.genreIds?.includes(section.genreId)
          ).slice(0, 15);

          return {
            title: section.title,
            items: filteredAnime,
          };
        }).filter(section => section.items.length > 0);

        setGenreSections(genreAnime);
      }
    } catch (error) {
      console.error("Error loading anime:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleContentClick = (item: AnimeWithMetadata) => {
    // Update URL with content ID
    const params = new URLSearchParams(searchParams.toString());
    params.set("content", item.id);
    router.push(`/anime?${params.toString()}`, { scroll: false });
  };

  const handleCloseModal = () => {
    // Remove content ID from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("content");
    router.push(`/anime?${params.toString()}`, { scroll: false });
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <div className="relative">
        {/* Featured Slider */}
        {featuredAnime.length > 0 && (
          <div className="relative -mt-20">
            <FeaturedSlider items={featuredAnime} />
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
              <p className="text-2xl text-gray-400 mb-2">No anime found</p>
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

export default function AnimePage() {
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <AnimePageContent />
    </Suspense>
  );
}
