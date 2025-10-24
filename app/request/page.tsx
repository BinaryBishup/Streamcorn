"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { searchMulti, searchMovies, searchTVShows, getTMDBImageUrl } from "@/lib/tmdb";
import { Search, X, ArrowLeft, Check, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  overview?: string;
}

interface Request {
  id: string;
  tmdb_id: number;
  content_type: string;
  title: string;
  poster_path: string | null;
  status: string;
  created_at: string;
  user_id: string;
  profile_id: string;
}

interface ContentAvailability {
  tmdbId: number;
  contentType: string;
  isInDatabase: boolean;
  isRequested: boolean;
  contentId?: string;
}

function RequestPageContent() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [selectedContentType, setSelectedContentType] = useState<string>("all");
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [availability, setAvailability] = useState<Map<string, ContentAvailability>>(new Map());
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [selectedTMDBItem, setSelectedTMDBItem] = useState<{ id: number; type: string } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"search" | "requests">("search");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { showToast, ToastContainer } = useToast();

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
    checkAuthAndLoadRequests();
  }, []);

  useEffect(() => {
    // Debounced search when user types
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        performSearch();
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
      setAvailability(new Map());
    }
  }, [searchQuery]);

  useEffect(() => {
    // Perform search when filters change
    if (searchQuery.trim()) {
      performSearch();
    }
  }, [selectedContentType]);

  const checkAuthAndLoadRequests = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      setUserId(user.id);

      const selectedProfile = localStorage.getItem("selectedProfile");
      if (!selectedProfile) {
        router.push("/profiles");
        return;
      }

      setProfileId(selectedProfile);
      await loadAllRequests();
    } catch (error) {
      console.error("Error checking auth:", error);
      router.push("/auth");
    }
  };

  const loadAllRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setAllRequests(data);
    } catch (error) {
      console.error("Error loading requests:", error);
    }
  };

  const checkAvailability = async (tmdbResults: TMDBResult[]) => {
    try {
      const availabilityMap = new Map<string, ContentAvailability>();

      // Get all TMDB IDs
      const tmdbIds = tmdbResults.map(r => r.id);

      // Check which exist in content database
      const { data: existingContent } = await supabase
        .from("content")
        .select("id, tmdb_id, content_type")
        .in("tmdb_id", tmdbIds);

      // Check which are already requested
      const { data: existingRequests } = await supabase
        .from("requests")
        .select("tmdb_id, content_type")
        .in("tmdb_id", tmdbIds);

      // Create lookup maps
      const contentMap = new Map(
        existingContent?.map(c => [`${c.tmdb_id}-${c.content_type}`, c]) || []
      );
      const requestMap = new Map(
        existingRequests?.map(r => [`${r.tmdb_id}-${r.content_type}`, true]) || []
      );

      // Check each result
      tmdbResults.forEach(result => {
        const contentType = selectedContentType === "anime"
          ? "anime"
          : result.media_type === "tv"
            ? "tv"
            : "movie";

        const key = `${result.id}-${contentType}`;
        const dbContent = contentMap.get(key);
        const isRequested = requestMap.has(key);

        availabilityMap.set(key, {
          tmdbId: result.id,
          contentType,
          isInDatabase: !!dbContent,
          isRequested,
          contentId: dbContent?.id,
        });
      });

      setAvailability(availabilityMap);
    } catch (error) {
      console.error("Error checking availability:", error);
    }
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setAvailability(new Map());
      return;
    }

    try {
      setLoading(true);

      let results: TMDBResult[] = [];

      if (selectedContentType === "all") {
        const multiResults = await searchMulti(searchQuery);
        if (multiResults) {
          results = multiResults.results;
        }
      } else if (selectedContentType === "movie") {
        const movieResults = await searchMovies(searchQuery);
        if (movieResults) {
          results = movieResults.results.map(r => ({ ...r, media_type: "movie" }));
        }
      } else if (selectedContentType === "tv" || selectedContentType === "anime") {
        const tvResults = await searchTVShows(searchQuery);
        if (tvResults) {
          results = tvResults.results.map(r => ({ ...r, media_type: "tv" }));
        }
      }

      setSearchResults(results);
      await checkAvailability(results);
    } catch (error) {
      console.error("Error searching:", error);
      setSearchResults([]);
      setAvailability(new Map());
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (item: TMDBResult) => {
    if (!userId || !profileId) {
      showToast("Please sign in to request content", "error");
      return;
    }

    try {
      const contentType = selectedContentType === "anime" ? "anime" : item.media_type === "tv" ? "tv" : "movie";
      const title = item.title || item.name || "";

      const { error } = await supabase.from("requests").insert({
        user_id: userId,
        profile_id: profileId,
        tmdb_id: item.id,
        content_type: contentType,
        title,
        poster_path: item.poster_path,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          showToast("This content has already been requested", "info");
        } else {
          throw error;
        }
      } else {
        showToast("Request submitted successfully!", "success");
        await loadAllRequests();
        await checkAvailability(searchResults);
        setActiveTab("requests");
      }
    } catch (error) {
      console.error("Error submitting request:", error);
      showToast("Failed to submit request. Please try again.", "error");
    }
  };

  const handleItemClick = (item: TMDBResult) => {
    const contentType = selectedContentType === "anime" ? "anime" : item.media_type === "tv" ? "tv" : "movie";
    const key = `${item.id}-${contentType}`;
    const avail = availability.get(key);

    if (avail?.isInDatabase && avail.contentId) {
      // Show modal for existing content
      const params = new URLSearchParams(searchParams.toString());
      params.set("content", avail.contentId);
      router.push(`/request?${params.toString()}`, { scroll: false });
    } else {
      // Show TMDB modal for non-existing content
      setSelectedTMDBItem({ id: item.id, type: contentType });
    }
  };

  const handleRequestClick = (request: Request) => {
    // Check if content exists in database
    const checkContent = async () => {
      const { data } = await supabase
        .from("content")
        .select("id")
        .eq("tmdb_id", request.tmdb_id)
        .eq("content_type", request.content_type)
        .single();

      if (data) {
        // Content exists, show modal
        const params = new URLSearchParams(searchParams.toString());
        params.set("content", data.id);
        router.push(`/request?${params.toString()}`, { scroll: false });
      } else {
        // Content doesn't exist yet
        setSelectedTMDBItem({ id: request.tmdb_id, type: request.content_type });
      }
    };

    checkContent();
  };

  const handleCloseModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("content");
    router.push(`/request?${params.toString()}`, { scroll: false });
    setSelectedTMDBItem(null);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setAvailability(new Map());
  };

  const getButtonContent = (item: TMDBResult) => {
    const contentType = selectedContentType === "anime" ? "anime" : item.media_type === "tv" ? "tv" : "movie";
    const key = `${item.id}-${contentType}`;
    const avail = availability.get(key);

    if (avail?.isInDatabase) {
      return {
        text: "Already Added",
        className: "bg-green-500/20 text-green-500 border border-green-500/50 cursor-not-allowed",
        disabled: true,
      };
    } else if (avail?.isRequested) {
      return {
        text: "Already Requested",
        className: "bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 cursor-not-allowed",
        disabled: true,
      };
    } else {
      return {
        text: "Request",
        className: "bg-white text-black hover:bg-gray-200",
        disabled: false,
      };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "approved":
        return <Check className="w-5 h-5 text-blue-500" />;
      case "completed":
        return <Check className="w-5 h-5 text-green-500" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-black">
      <ToastContainer />

      {/* Back Button */}
      <div className="fixed top-6 left-6 z-50">
        <Link href="/">
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-full bg-black/80 hover:bg-black border border-white/30"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </Button>
        </Link>
      </div>

      <div className="pt-24 px-4 md:px-16 pb-16">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Request Content</h1>
          <p className="text-gray-400">Can't find what you're looking for? Request it and we'll add it!</p>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto mb-8">
          <div className="flex gap-4 border-b border-gray-800">
            <button
              onClick={() => setActiveTab("search")}
              className={`pb-3 px-4 text-lg font-semibold transition-colors relative ${
                activeTab === "search" ? "text-white" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Search & Request
              {activeTab === "search" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`pb-3 px-4 text-lg font-semibold transition-colors relative ${
                activeTab === "requests" ? "text-white" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              All Requests ({allRequests.length})
              {activeTab === "requests" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t" />
              )}
            </button>
          </div>
        </div>

        {/* Search Tab */}
        {activeTab === "search" && (
          <div className="max-w-6xl mx-auto">
            {/* Search Input */}
            <form onSubmit={(e) => { e.preventDefault(); performSearch(); }} className="relative mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for movies, TV shows, or anime..."
                  className="w-full bg-gray-900 text-white pl-12 pr-12 py-4 rounded-lg border border-gray-800 focus:border-white focus:outline-none text-lg"
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

            {/* Filters */}
            <div className="flex gap-2 mb-8">
              <Button
                onClick={() => setSelectedContentType("all")}
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

            {/* Search Results */}
            {loading && (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
              </div>
            )}

            {!loading && searchResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {searchResults.map((item) => {
                  const buttonInfo = getButtonContent(item);
                  return (
                    <div
                      key={item.id}
                      className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      <div className="relative aspect-[2/3]">
                        {item.poster_path ? (
                          <Image
                            src={getTMDBImageUrl(item.poster_path, "w500")}
                            alt={item.title || item.name || ""}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <span className="text-gray-600">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="text-white font-semibold mb-2 line-clamp-2">
                          {item.title || item.name}
                        </h3>
                        <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                          <span>{item.release_date?.split("-")[0] || item.first_air_date?.split("-")[0] || "N/A"}</span>
                          {item.vote_average > 0 && (
                            <span className="flex items-center gap-1">
                              ⭐ {item.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!buttonInfo.disabled) {
                              handleRequest(item);
                            }
                          }}
                          className={`w-full ${buttonInfo.className}`}
                          disabled={buttonInfo.disabled}
                        >
                          {buttonInfo.text}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-400 text-xl">No results found for "{searchQuery}"</p>
                <p className="text-gray-500 mt-2">Try adjusting your search query</p>
              </div>
            )}

            {!loading && !searchQuery && (
              <div className="text-center py-20">
                <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-xl">Start typing to search</p>
                <p className="text-gray-500 mt-2">Search TMDB and request content to be added</p>
              </div>
            )}
          </div>
        )}

        {/* All Requests Tab */}
        {activeTab === "requests" && (
          <div className="max-w-6xl mx-auto">
            {allRequests.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-400 text-xl">No requests yet</p>
                <p className="text-gray-500 mt-2">Be the first to request content!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {allRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
                    onClick={() => handleRequestClick(request)}
                  >
                    <div className="relative aspect-[2/3]">
                      {request.poster_path ? (
                        <Image
                          src={getTMDBImageUrl(request.poster_path, "w500")}
                          alt={request.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <span className="text-gray-600">No image</span>
                        </div>
                      )}
                      {/* Status Badge */}
                      <div className={`absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                        request.status === "pending" ? "bg-yellow-500/20 text-yellow-500" :
                        request.status === "approved" ? "bg-blue-500/20 text-blue-500" :
                        request.status === "completed" ? "bg-green-500/20 text-green-500" :
                        "bg-red-500/20 text-red-500"
                      }`}>
                        {getStatusIcon(request.status)}
                        {getStatusText(request.status)}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-white font-semibold mb-2 line-clamp-2">
                        {request.title}
                      </h3>
                      <div className="text-sm text-gray-400">
                        <span className="capitalize">{request.content_type}</span>
                        <span className="mx-2">•</span>
                        <span>{new Date(request.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content Details Modal */}
      {selectedContentId && (
        <ContentDetailsModal
          contentId={selectedContentId}
          onClose={handleCloseModal}
        />
      )}

      {/* TMDB Item Modal (for non-existing content) - TODO: Create a special modal for this */}
      {selectedTMDBItem && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-white text-xl font-bold mb-4">Content Not Available</h3>
            <p className="text-gray-400 mb-6">
              This content hasn't been added to our platform yet. You can request it to be added!
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleCloseModal}
                variant="outline"
                className="flex-1 bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  // Find the item in search results and request it
                  const item = searchResults.find(r => r.id === selectedTMDBItem.id);
                  if (item) {
                    handleRequest(item);
                    handleCloseModal();
                  }
                }}
                className="flex-1 bg-white text-black hover:bg-gray-200"
              >
                Request It
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <RequestPageContent />
    </Suspense>
  );
}
