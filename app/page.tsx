"use client";

import { Suspense, useEffect, useState, lazy } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { FeaturedSlider } from "@/components/content/featured-slider";
import { ContentRow } from "@/components/content/content-row";
import { SkeletonLoader } from "@/components/ui/skeleton-loader";
import { ContinueWatchingRow } from "@/components/content/continue-watching-row";
import { fetchMovieDetails, fetchTVShowDetails, getTMDBImageUrl, fetchMultipleContent } from "@/lib/tmdb";
import { getContinueWatching, type ContinueWatchingItem } from "@/lib/watch-progress";

// Lazy load the modal since it's not needed on initial page load
const ContentDetailsModal = dynamic(
  () => import("@/components/content/content-details-modal").then(mod => ({ default: mod.ContentDetailsModal })),
  { ssr: false }
);

interface Content {
  id: string;
  tmdb_id: number;
  content_type: "movie" | "tv" | "anime";
  platform_id: string;
  is_featured: boolean;
}

interface ContentWithMetadata {
  id: string;
  tmdbId: number;
  title: string;
  overview?: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating?: number;
  type: "movie" | "tv" | "anime";
}

interface HomeFeedSection {
  id: string;
  title: string;
  section_type: string;
  content_type: string | null;
  genre: string | null;
  display_order: number;
}

function HomePageContent() {
  const [loading, setLoading] = useState(true);
  const [featuredItems, setFeaturedItems] = useState<ContentWithMetadata[]>([]);
  const [sections, setSections] = useState<{ section: HomeFeedSection; items: ContentWithMetadata[] }[]>([]);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
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

  useEffect(() => {
    // Load continue watching when profile is available
    if (profileId) {
      loadContinueWatching();
    }
  }, [profileId]);

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

      setProfileId(selectedProfile);
      await loadContent();
    } catch (error) {
      console.error("Error checking auth:", error);
      router.push("/auth");
    }
  };

  const loadContent = async () => {
    try {
      setLoading(true);

      // Load featured content
      await loadFeaturedContent();

      // Load home feed sections
      await loadHomeFeedSections();
    } catch (error) {
      console.error("Error loading content:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeaturedContent = async () => {
    try {
      let query = supabase
        .from("content")
        .select("*")
        .eq("is_featured", true)
        .limit(5);

      if (selectedPlatform) {
        query = query.eq("platform_id", selectedPlatform);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // PERFORMANCE: Batch fetch all TMDB data in parallel
        const contentItems = data.map(c => ({
          tmdbId: c.tmdb_id,
          type: c.content_type as 'movie' | 'tv' | 'anime'
        }));

        const tmdbDataMap = await fetchMultipleContent(contentItems, true);

        const itemsWithMetadata = data.map((content: Content) => {
          const tmdbData = tmdbDataMap.get(content.tmdb_id);
          const isTVContent = content.content_type === "tv" || content.content_type === "anime";

          return {
            id: content.id,
            tmdbId: content.tmdb_id,
            title: isTVContent
              ? (tmdbData as any)?.name || `${content.content_type} ${content.tmdb_id}`
              : (tmdbData as any)?.title || `Movie ${content.tmdb_id}`,
            overview: tmdbData?.overview,
            posterPath: getTMDBImageUrl(tmdbData?.poster_path || null, "w500") || null,
            backdropPath: getTMDBImageUrl(tmdbData?.backdrop_path || null, "w780") || null,
            rating: tmdbData?.vote_average || 0,
            type: content.content_type,
            trailerKey: tmdbData?.videos?.results?.find(v => v.type === "Trailer" && v.site === "YouTube")?.key,
          };
        });

        setFeaturedItems(itemsWithMetadata);
      }
    } catch (error) {
      console.error("Error loading featured content:", error);
    }
  };

  const loadHomeFeedSections = async () => {
    try {
      // Get all active sections ordered by display_order
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("home_feed_sections")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (sectionsError) throw sectionsError;

      if (sectionsData) {
        const sectionsWithContent = await Promise.all(
          sectionsData.slice(0, 10).map(async (section: HomeFeedSection) => {
            const items = await loadSectionContent(section);
            return { section, items };
          })
        );

        setSections(sectionsWithContent.filter(s => s.items.length > 0));
      }
    } catch (error) {
      console.error("Error loading home feed sections:", error);
    }
  };

  const loadSectionContent = async (section: HomeFeedSection): Promise<ContentWithMetadata[]> => {
    try {
      let query = supabase.from("content").select("*");

      // Filter by content type if specified
      if (section.content_type && section.content_type !== "all") {
        query = query.eq("content_type", section.content_type);
      }

      // Apply platform filter if active
      if (selectedPlatform) {
        query = query.eq("platform_id", selectedPlatform);
      }

      // Limit results
      query = query.limit(section.section_type === "continue_watching" ? 10 : 15);

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // PERFORMANCE: Batch fetch all TMDB data in parallel
        const contentItems = data.map(c => ({
          tmdbId: c.tmdb_id,
          type: c.content_type as 'movie' | 'tv' | 'anime'
        }));

        const tmdbDataMap = await fetchMultipleContent(contentItems, false);

        const itemsWithMetadata = data.map((content: Content) => {
          const tmdbData = tmdbDataMap.get(content.tmdb_id);
          const isTVContent = content.content_type === "tv" || content.content_type === "anime";

          return {
            id: content.id,
            tmdbId: content.tmdb_id,
            title: isTVContent
              ? (tmdbData as any)?.name || `${content.content_type} ${content.tmdb_id}`
              : (tmdbData as any)?.title || `Movie ${content.tmdb_id}`,
            posterPath: getTMDBImageUrl(tmdbData?.poster_path || null, "w500"),
            backdropPath: getTMDBImageUrl(tmdbData?.backdrop_path || null, "w780"),
            rating: tmdbData?.vote_average || 0,
            type: content.content_type,
          };
        });

        return itemsWithMetadata;
      }

      return [];
    } catch (error) {
      console.error(`Error loading section ${section.title}:`, error);
      return [];
    }
  };

  const loadContinueWatching = async () => {
    if (!profileId) return;

    try {
      const items = await getContinueWatching(profileId, 15);
      setContinueWatching(items);
    } catch (error) {
      console.error("Error loading continue watching:", error);
    }
  };

  const handleContentClick = (item: ContentWithMetadata | ContinueWatchingItem) => {
    // Update URL with content ID
    const params = new URLSearchParams(searchParams.toString());
    const contentId = "content" in item && item.content ? item.content.id : item.id;
    params.set("content", contentId);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const handleCloseModal = () => {
    // Remove content ID from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("content");
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  if (loading) {
    return <SkeletonLoader />;
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <Header />

      <div className="relative">
        {/* Featured Slider */}
        {featuredItems.length > 0 && (
          <div className="relative -mt-20">
            <FeaturedSlider
              items={featuredItems}
              onItemClick={handleContentClick}
              onPlayClick={(item) => {
                // Open modal with auto-play enabled
                handleContentClick(item);
              }}
              profileId={profileId}
            />
          </div>
        )}

        {/* Content Rows */}
        <div className="relative bg-black pt-4 pb-8">
          {/* Continue Watching */}
          {continueWatching.length > 0 && (
            <ContinueWatchingRow
              items={continueWatching}
              onItemClick={handleContentClick}
            />
          )}

          {/* Regular Content Rows */}
          {sections
            .filter(({ section }) => section.section_type !== "continue_watching")
            .map(({ section, items }) => (
              <ContentRow
                key={section.id}
                title={section.title}
                items={items}
                onItemClick={handleContentClick}
              />
            ))}

          {sections.length === 0 && continueWatching.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-400 text-xl">
                {selectedPlatform
                  ? "No content available for this platform"
                  : "No content available"}
              </p>
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

export default function HomePage() {
  return (
    <Suspense fallback={<SkeletonLoader />}>
      <HomePageContent />
    </Suspense>
  );
}
