"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { FeaturedSlider } from "@/components/content/featured-slider";
import { ContentRow } from "@/components/content/content-row";
import { ContentDetailsModal } from "@/components/content/content-details-modal";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { fetchMovieDetails, getTMDBImageUrl, MOVIE_GENRES } from "@/lib/tmdb";

interface Content {
  id: string;
  tmdb_id: number;
  content_type: string;
  platform_id: string;
  is_featured: boolean;
}

interface MovieWithMetadata {
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
  { title: "Action Movies", genreId: MOVIE_GENRES.ACTION },
  { title: "Comedy Movies", genreId: MOVIE_GENRES.COMEDY },
  { title: "Thriller Movies", genreId: MOVIE_GENRES.THRILLER },
  { title: "Crime Movies", genreId: MOVIE_GENRES.CRIME },
  { title: "Horror Movies", genreId: MOVIE_GENRES.HORROR },
  { title: "Drama Movies", genreId: MOVIE_GENRES.DRAMA },
  { title: "Science Fiction", genreId: MOVIE_GENRES.SCIENCE_FICTION },
  { title: "Romance Movies", genreId: MOVIE_GENRES.ROMANCE },
];

function MoviesPageContent() {
  const [loading, setLoading] = useState(true);
  const [featuredMovies, setFeaturedMovies] = useState<MovieWithMetadata[]>([]);
  const [genreSections, setGenreSections] = useState<{ title: string; items: MovieWithMetadata[] }[]>([]);
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

      await loadMovies();
    } catch (error) {
      console.error("Error checking auth:", error);
      router.push("/auth");
    }
  };

  const loadMovies = async () => {
    try {
      setLoading(true);

      // Load featured movies
      let featuredQuery = supabase
        .from("content")
        .select("*")
        .eq("content_type", "movie")
        .eq("is_featured", true)
        .limit(5);

      if (selectedPlatform) {
        featuredQuery = featuredQuery.eq("platform_id", selectedPlatform);
      }

      const { data: featuredData } = await featuredQuery;

      if (featuredData && featuredData.length > 0) {
        const featuredWithMetadata = await Promise.all(
          featuredData.map(async (content: Content) => {
            const tmdbData = await fetchMovieDetails(content.tmdb_id, true);
            return {
              id: content.id,
              tmdbId: content.tmdb_id,
              title: tmdbData?.title || `Movie ${content.tmdb_id}`,
              overview: tmdbData?.overview,
              posterPath: getTMDBImageUrl(tmdbData?.poster_path || null, "w500"),
              backdropPath: getTMDBImageUrl(tmdbData?.backdrop_path || null, "w1280"),
              rating: tmdbData?.vote_average || 0,
              type: "movie" as const,
              trailerKey: tmdbData?.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube")?.key,
            };
          })
        );
        setFeaturedMovies(featuredWithMetadata);
      }

      // Load all movies
      let query = supabase
        .from("content")
        .select("*")
        .eq("content_type", "movie")
        .order("created_at", { ascending: false });

      if (selectedPlatform) {
        query = query.eq("platform_id", selectedPlatform);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch TMDB metadata for all movies
        const moviesWithMetadata = await Promise.all(
          data.map(async (content: Content) => {
            const tmdbData = await fetchMovieDetails(content.tmdb_id);
            return {
              id: content.id,
              tmdbId: content.tmdb_id,
              title: tmdbData?.title || `Movie ${content.tmdb_id}`,
              posterPath: getTMDBImageUrl(tmdbData?.poster_path || null, "w500"),
              backdropPath: getTMDBImageUrl(tmdbData?.backdrop_path || null, "w1280"),
              rating: tmdbData?.vote_average || 0,
              type: "movie" as const,
              genreIds: tmdbData?.genre_ids || tmdbData?.genres?.map(g => g.id) || [],
            };
          })
        );

        // Organize movies by genre
        const genreMovies = GENRE_SECTIONS.map(section => {
          const filteredMovies = moviesWithMetadata.filter(movie =>
            movie.genreIds?.includes(section.genreId)
          ).slice(0, 15);

          return {
            title: section.title,
            items: filteredMovies,
          };
        }).filter(section => section.items.length > 0);

        setGenreSections(genreMovies);
      }
    } catch (error) {
      console.error("Error loading movies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleContentClick = (item: MovieWithMetadata) => {
    // Update URL with content ID
    const params = new URLSearchParams(searchParams.toString());
    params.set("content", item.id);
    router.push(`/movies?${params.toString()}`, { scroll: false });
  };

  const handleCloseModal = () => {
    // Remove content ID from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("content");
    router.push(`/movies?${params.toString()}`, { scroll: false });
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <div className="relative">
        {/* Featured Slider */}
        {featuredMovies.length > 0 && (
          <div className="relative -mt-20">
            <FeaturedSlider items={featuredMovies} />
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
              <p className="text-2xl text-gray-400 mb-2">No movies found</p>
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

export default function MoviesPage() {
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <MoviesPageContent />
    </Suspense>
  );
}
