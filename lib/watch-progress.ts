import { createClient } from "@/lib/supabase/client";

export interface WatchProgress {
  id: string;
  profile_id: string;
  content_uuid: string;
  episode_id: string | null;
  last_position: number;
  duration: number;
  season_number: number | null;
  episode_number: number | null;
  updated_at: string;
}

export interface ContinueWatchingItem extends WatchProgress {
  content: {
    id: string;
    tmdb_id: number;
    content_type: "movie" | "tv" | "anime";
    platform_id: string;
  };
}

/**
 * Get watch progress for a specific content
 */
export async function getWatchProgress(
  contentId: string,
  profileId: string
): Promise<WatchProgress | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("continue_watching")
    .select("*")
    .eq("content_uuid", contentId)
    .eq("profile_id", profileId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as WatchProgress;
}

/**
 * Update or create watch progress
 */
export async function updateWatchProgress(
  contentId: string,
  profileId: string,
  position: number,
  duration: number,
  episodeId?: string,
  seasonNumber?: number,
  episodeNumber?: number
): Promise<void> {
  const supabase = createClient();

  const existing = await getWatchProgress(contentId, profileId);

  if (existing) {
    await supabase
      .from("continue_watching")
      .update({
        last_position: position,
        duration,
        episode_id: episodeId || null,
        season_number: seasonNumber || null,
        episode_number: episodeNumber || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("continue_watching").insert({
      profile_id: profileId,
      content_uuid: contentId,
      last_position: position,
      duration,
      episode_id: episodeId || null,
      season_number: seasonNumber || null,
      episode_number: episodeNumber || null,
    });
  }
}

/**
 * Get all continue watching items for a profile
 */
export async function getContinueWatching(
  profileId: string,
  limit: number = 10
): Promise<ContinueWatchingItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("continue_watching")
    .select(
      `
      *,
      content:content_uuid (
        id,
        tmdb_id,
        content_type,
        platform_id
      )
    `
    )
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data as ContinueWatchingItem[];
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(position: number, duration: number): number {
  if (duration === 0) return 0;
  return Math.min(Math.round((position / duration) * 100), 100);
}

/**
 * Check if content is completed
 */
export function isContentCompleted(position: number, duration: number, threshold: number = 120): boolean {
  // Consider completed if within threshold seconds of the end
  return duration - position <= threshold;
}

/**
 * Get next episode to watch
 */
export async function getNextEpisode(
  contentId: string,
  currentSeasonNumber: number,
  currentEpisodeNumber: number
): Promise<{ seasonNumber: number; episodeNumber: number } | null> {
  const supabase = createClient();

  // Try to get next episode in same season
  const { data: nextEpisode } = await supabase
    .from("episodes")
    .select("episode_number, season:seasons!inner(season_number)")
    .eq("seasons.content_id", contentId)
    .eq("seasons.season_number", currentSeasonNumber)
    .eq("episode_number", currentEpisodeNumber + 1)
    .single();

  if (nextEpisode) {
    return {
      seasonNumber: currentSeasonNumber,
      episodeNumber: currentEpisodeNumber + 1,
    };
  }

  // Try to get first episode of next season
  const { data: nextSeason } = await supabase
    .from("episodes")
    .select("episode_number, season:seasons!inner(season_number)")
    .eq("seasons.content_id", contentId)
    .eq("seasons.season_number", currentSeasonNumber + 1)
    .order("episode_number", { ascending: true })
    .limit(1)
    .single();

  if (nextSeason) {
    return {
      seasonNumber: currentSeasonNumber + 1,
      episodeNumber: (nextSeason as any).episode_number,
    };
  }

  return null;
}
