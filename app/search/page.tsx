"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { getTMDBImageUrl } from "@/lib/tmdb";
import { Search, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentCardHover } from "@/components/content/content-card-hover";
import { OTT_PLATFORMS } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";

// Lazy load the modal
const ContentDetailsModal = dynamic(
  () => import("@/components/content/content-details-modal").then(mod => ({ default: mod.ContentDetailsModal })),
  { ssr: false }
);

interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  media_type?: string;
  content_type?: "movie" | "tv" | "anime";
}

interface ContentWithMetadata {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  rating?: number;
  type: "movie" | "tv" | "anime";
}

function SearchPageContent() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ContentWithMetadata[]>([]);
  const [selectedContentType, setSelectedContentType] = useState<string>("all");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const contentId = searchParams.get("content");
  const queryParam = searchParams.get("q");

  useEffect(() => {
    // Show modal if content ID is in URL
    if (contentId) {
      setSelectedContentId(contentId);
    } else {
      setSelectedContentId(null);
    }
  }, [contentId]);

  useEffect(() => {
    // Load search query from URL parameter
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, []);

  useEffect(() => {
    // Perform search when query is loaded from URL
    if (queryParam && searchQuery) {
      performSearch();
    }
  }, [queryParam, searchQuery]);

  useEffect(() => {
    // Debounced search when user types
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        performSearch();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    // Perform search when filters change
    if (searchQuery.trim()) {
      performSearch();
    }
  }, [selectedContentType, selectedPlatform]);

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);

      // Search our database by tags
      const searchTerm = searchQuery.toLowerCase().trim();

      // Build the query based on filters
      let query = supabase
        .from("content")
        .select("id, tmdb_id, content_type, tags, platform_id");

      // Apply content type filter
      if (selectedContentType !== "all") {
        query = query.eq("content_type", selectedContentType);
      }

      // Apply platform filter
      if (selectedPlatform !== "all") {
        query = query.eq("platform_id", selectedPlatform);
      }

      const { data: matchingContent, error } = await query;

      if (error) {
        console.error("Error searching database:", error);
        setResults([]);
        return;
      }

      if (!matchingContent || matchingContent.length === 0) {
        setResults([]);
        return;
      }

      // Filter content by tags matching the search term
      const filteredContent = matchingContent.filter((content) => {
        if (!content.tags || content.tags.length === 0) return false;

        // Check if any tag contains the search term
        return content.tags.some((tag: string) =>
          tag.toLowerCase().includes(searchTerm)
        );
      });

      if (filteredContent.length === 0) {
        setResults([]);
        return;
      }

      // Fetch TMDB details for each matching content
      const resultsWithMetadata = await Promise.all(
        filteredContent.map(async (content) => {
          try {
            // Fetch TMDB details based on content type
            let tmdbData = null;

            if (content.content_type === "movie") {
              const movieData = await fetch(
                `https://api.themoviedb.org/3/movie/${content.tmdb_id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=en-US`
              );
              if (movieData.ok) {
                tmdbData = await movieData.json();
              }
            } else {
              const tvData = await fetch(
                `https://api.themoviedb.org/3/tv/${content.tmdb_id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=en-US`
              );
              if (tvData.ok) {
                tmdbData = await tvData.json();
              }
            }

            if (!tmdbData) return null;

            return {
              id: content.id,
              tmdbId: content.tmdb_id,
              title: tmdbData.title || tmdbData.name || "",
              posterPath: getTMDBImageUrl(tmdbData.poster_path, "w500"),
              backdropPath: getTMDBImageUrl(tmdbData.backdrop_path, "w780"),
              rating: tmdbData.vote_average || 0,
              type: content.content_type,
            } as ContentWithMetadata;
          } catch (err) {
            console.error(`Error fetching TMDB details for ${content.tmdb_id}:`, err);
            return null;
          }
        })
      );

      // Filter out null results and set state
      const validResults = resultsWithMetadata.filter(
        (item): item is ContentWithMetadata => item !== null
      );

      setResults(validResults);
    } catch (error) {
      console.error("Error searching content:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleContentClick = (item: ContentWithMetadata) => {
    // Update URL with content ID
    const params = new URLSearchParams(searchParams.toString());
    params.set("content", item.id);
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const handleCloseModal = () => {
    // Remove content ID from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("content");
    router.push(`/search?${params.toString()}`, { scroll: false });
  };

  const clearSearch = () => {
    setSearchQuery("");
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Top Bar with Back Button and Search */}
      <div className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="px-4 md:px-16 py-4">
          <div className="flex items-center gap-4">
            {/* Back Button */}
            <Link href="/">
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full bg-black/80 hover:bg-black border border-white/30 flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </Button>
            </Link>

            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex-1 max-w-4xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for movies, TV shows, or anime..."
                  className="w-full bg-gray-900 text-white pl-12 pr-12 py-3 rounded-lg border border-gray-800 focus:border-white focus:outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 mt-4 items-center">
            {/* Content Type Filter */}
            <div className="flex gap-2">
              <Button
                onClick={() => setSelectedContentType("all")}
                size="sm"
                variant={selectedContentType === "all" ? "default" : "outline"}
                className={
                  selectedContentType === "all"
                    ? "bg-white text-black hover:bg-gray-200"
                    : "bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
                }
              >
                All
              </Button>
              <Button
                onClick={() => setSelectedContentType("movie")}
                size="sm"
                variant={selectedContentType === "movie" ? "default" : "outline"}
                className={
                  selectedContentType === "movie"
                    ? "bg-white text-black hover:bg-gray-200"
                    : "bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
                }
              >
                Movies
              </Button>
              <Button
                onClick={() => setSelectedContentType("tv")}
                size="sm"
                variant={selectedContentType === "tv" ? "default" : "outline"}
                className={
                  selectedContentType === "tv"
                    ? "bg-white text-black hover:bg-gray-200"
                    : "bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
                }
              >
                TV Shows
              </Button>
              <Button
                onClick={() => setSelectedContentType("anime")}
                size="sm"
                variant={selectedContentType === "anime" ? "default" : "outline"}
                className={
                  selectedContentType === "anime"
                    ? "bg-white text-black hover:bg-gray-200"
                    : "bg-gray-900 text-white border-gray-700 hover:bg-gray-800"
                }
              >
                Anime
              </Button>
            </div>

            {/* Platform Filter with Logos */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedPlatform("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPlatform === "all"
                    ? "bg-white text-black"
                    : "bg-gray-900 text-white border border-gray-700 hover:bg-gray-800"
                }`}
              >
                All Platforms
              </button>
              {OTT_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id)}
                  className={`relative h-10 px-3 rounded-lg transition-all flex items-center justify-center ${
                    selectedPlatform === platform.id
                      ? "bg-white/20 ring-2 ring-white/50 scale-105"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                  title={platform.name}
                >
                  <Image
                    src={platform.logo}
                    alt={platform.name}
                    width={60}
                    height={24}
                    className="object-contain max-h-6"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-16 py-8">

        {/* Results Section */}
        <div>
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
          )}

          {!loading && searchQuery && results.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-400 text-xl mb-6">No results found for "{searchQuery}"</p>
              <p className="text-gray-500 mb-8">The content you're looking for is not available yet</p>
              <Link href="/request">
                <Button className="bg-white text-black hover:bg-gray-200 font-semibold px-8 py-6 text-lg">
                  Request Content
                </Button>
              </Link>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div>
              <p className="text-gray-400 mb-6">
                {results.length} result{results.length !== 1 ? "s" : ""} found
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                {results.map((item) => (
                  <ContentCardHover
                    key={item.id}
                    id={item.id}
                    tmdbId={item.tmdbId}
                    title={item.title}
                    posterPath={item.posterPath}
                    backdropPath={item.backdropPath || null}
                    rating={item.rating || 0}
                    type={item.type}
                    onClick={() => handleContentClick(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {!loading && !searchQuery && (
            <div className="text-center py-20">
              <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-xl">Start typing to search for content</p>
              <p className="text-gray-500 mt-2">We'll search across all available movies, TV shows, and anime</p>
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

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SearchPageContent />
    </Suspense>
  );
}
