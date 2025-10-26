const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = process.env.NEXT_PUBLIC_TMDB_BASE_URL || "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p";

// In-memory cache for TMDB API responses
const tmdbCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Get cached data or fetch from TMDB
 */
function getCachedOrFetch<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  cacheDuration: number = CACHE_DURATION
): Promise<T> {
  const cached = tmdbCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < cacheDuration) {
    return Promise.resolve(cached.data);
  }

  return fetchFn().then((data) => {
    tmdbCache.set(cacheKey, { data, timestamp: now });
    return data;
  });
}

// TMDB Genre IDs
export const MOVIE_GENRES = {
  ACTION: 28,
  ADVENTURE: 12,
  ANIMATION: 16,
  COMEDY: 35,
  CRIME: 80,
  DOCUMENTARY: 99,
  DRAMA: 18,
  FAMILY: 10751,
  FANTASY: 14,
  HISTORY: 36,
  HORROR: 27,
  MUSIC: 10402,
  MYSTERY: 9648,
  ROMANCE: 10749,
  SCIENCE_FICTION: 878,
  THRILLER: 53,
  WAR: 10752,
  WESTERN: 37,
};

export const TV_GENRES = {
  ACTION_ADVENTURE: 10759,
  ANIMATION: 16,
  COMEDY: 35,
  CRIME: 80,
  DOCUMENTARY: 99,
  DRAMA: 18,
  FAMILY: 10751,
  KIDS: 10762,
  MYSTERY: 9648,
  NEWS: 10763,
  REALITY: 10764,
  SCI_FI_FANTASY: 10765,
  SOAP: 10766,
  TALK: 10767,
  WAR_POLITICS: 10768,
  WESTERN: 37,
};

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: { id: number; name: string }[];
  adult: boolean;
  popularity: number;
  videos?: {
    results: { key: string; type: string; site: string }[];
  };
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: { id: number; name: string }[];
  popularity: number;
  videos?: {
    results: { key: string; type: string; site: string }[];
  };
}

export interface TMDBSeason {
  air_date: string;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
  air_date: string;
  vote_average: number;
  runtime: number | null;
}

/**
 * Get TMDB image URL for different sizes
 */
export function getTMDBImageUrl(path: string | null, size: "original" | "w500" | "w780" | "w1280" = "w500"): string {
  if (!path) return "/placeholder-poster.jpg";
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

/**
 * Fetch movie details from TMDB (with caching)
 */
export async function fetchMovieDetails(tmdbId: number, includeVideos: boolean = false): Promise<TMDBMovie | null> {
  const cacheKey = `movie:${tmdbId}:${includeVideos}`;

  return getCachedOrFetch(cacheKey, async () => {
    try {
      const appendParam = includeVideos ? '&append_to_response=videos' : '';
      const response = await fetch(
        `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US${appendParam}`,
        { next: { revalidate: 86400 } }
      );

      if (!response.ok) {
        console.error(`Failed to fetch movie ${tmdbId}:`, response.statusText);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching movie ${tmdbId}:`, error);
      return null;
    }
  });
}

/**
 * Fetch TV show details from TMDB (with caching)
 */
export async function fetchTVShowDetails(tmdbId: number, includeVideos: boolean = false): Promise<TMDBTVShow | null> {
  const cacheKey = `tv:${tmdbId}:${includeVideos}`;

  return getCachedOrFetch(cacheKey, async () => {
    try {
      const appendParam = includeVideos ? '&append_to_response=videos' : '';
      const response = await fetch(
        `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US${appendParam}`,
        { next: { revalidate: 86400 } }
      );

      if (!response.ok) {
        console.error(`Failed to fetch TV show ${tmdbId}:`, response.statusText);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching TV show ${tmdbId}:`, error);
      return null;
    }
  });
}

/**
 * Fetch season details from TMDB
 */
export async function fetchSeasonDetails(tvId: number, seasonNumber: number): Promise<TMDBSeason | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch season ${seasonNumber} of TV show ${tvId}:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} of TV show ${tvId}:`, error);
    return null;
  }
}

/**
 * Fetch episode details from TMDB
 */
export async function fetchEpisodeDetails(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<TMDBEpisode | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch episode ${seasonNumber}x${episodeNumber} of TV show ${tvId}:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching episode ${seasonNumber}x${episodeNumber} of TV show ${tvId}:`, error);
    return null;
  }
}

/**
 * Search for movies on TMDB
 */
export async function searchMovies(query: string, page: number = 1): Promise<{ results: TMDBMovie[]; total_pages: number } | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=${page}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );

    if (!response.ok) {
      console.error(`Failed to search movies:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error searching movies:`, error);
    return null;
  }
}

/**
 * Search for TV shows on TMDB
 */
export async function searchTVShows(query: string, page: number = 1): Promise<{ results: TMDBTVShow[]; total_pages: number } | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=${page}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      console.error(`Failed to search TV shows:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error searching TV shows:`, error);
    return null;
  }
}

/**
 * Multi-search across movies, TV shows, and people on TMDB
 */
export async function searchMulti(query: string, page: number = 1): Promise<{ results: (TMDBMovie | TMDBTVShow)[]; total_pages: number; total_results: number } | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=${page}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      console.error(`Failed to search:`, response.statusText);
      return null;
    }

    const data = await response.json();
    // Filter out people, keep only movies and TV shows
    const filtered = {
      ...data,
      results: data.results.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
    };
    return filtered;
  } catch (error) {
    console.error(`Error searching:`, error);
    return null;
  }
}

/**
 * Fetch images (logos, backdrops, posters) for a movie from TMDB
 */
export async function fetchMovieImages(tmdbId: number): Promise<{
  logos: { file_path: string; iso_639_1: string }[];
  backdrops: { file_path: string }[];
  posters: { file_path: string }[];
} | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}/images?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch movie images ${tmdbId}:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching movie images ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Fetch images (logos, backdrops, posters) for a TV show from TMDB
 */
export async function fetchTVShowImages(tmdbId: number): Promise<{
  logos: { file_path: string; iso_639_1: string }[];
  backdrops: { file_path: string }[];
  posters: { file_path: string }[];
} | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}/images?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch TV show images ${tmdbId}:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching TV show images ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Fetch movie recommendations from TMDB
 */
export async function fetchMovieRecommendations(tmdbId: number): Promise<TMDBMovie[] | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}/recommendations?api_key=${TMDB_API_KEY}&language=en-US&page=1`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch movie recommendations ${tmdbId}:`, response.statusText);
      return null;
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`Error fetching movie recommendations ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Fetch TV show recommendations from TMDB
 */
export async function fetchTVShowRecommendations(tmdbId: number): Promise<TMDBTVShow[] | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}/recommendations?api_key=${TMDB_API_KEY}&language=en-US&page=1`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch TV show recommendations ${tmdbId}:`, response.statusText);
      return null;
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`Error fetching TV show recommendations ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Fetch movie credits (cast and crew) from TMDB
 */
export async function fetchMovieCredits(tmdbId: number): Promise<{
  cast: { id: number; name: string; character: string; profile_path: string | null }[];
  crew: { id: number; name: string; job: string; profile_path: string | null }[];
} | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch movie credits ${tmdbId}:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching movie credits ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Fetch TV show credits (cast and crew) from TMDB
 */
export async function fetchTVShowCredits(tmdbId: number): Promise<{
  cast: { id: number; name: string; character: string; profile_path: string | null }[];
  crew: { id: number; name: string; job: string; profile_path: string | null }[];
} | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}/credits?api_key=${TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch TV show credits ${tmdbId}:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching TV show credits ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Fetch movie videos (trailers, teasers) from TMDB
 */
export async function fetchMovieVideos(tmdbId: number): Promise<{
  results: { key: string; type: string; site: string; name: string }[];
} | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch movie videos ${tmdbId}:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching movie videos ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Fetch TV show videos (trailers, teasers) from TMDB
 */
export async function fetchTVShowVideos(tmdbId: number): Promise<{
  results: { key: string; type: string; site: string; name: string }[];
} | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      console.error(`Failed to fetch TV show videos ${tmdbId}:`, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching TV show videos ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Batch fetch multiple movies in parallel (PERFORMANCE OPTIMIZED)
 */
export async function fetchMultipleMovies(
  tmdbIds: number[],
  includeVideos: boolean = false
): Promise<Map<number, TMDBMovie>> {
  const results = new Map<number, TMDBMovie>();

  // Fetch all movies in parallel
  const promises = tmdbIds.map(async (id) => {
    const movie = await fetchMovieDetails(id, includeVideos);
    if (movie) {
      results.set(id, movie);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Batch fetch multiple TV shows in parallel (PERFORMANCE OPTIMIZED)
 */
export async function fetchMultipleTVShows(
  tmdbIds: number[],
  includeVideos: boolean = false
): Promise<Map<number, TMDBTVShow>> {
  const results = new Map<number, TMDBTVShow>();

  // Fetch all TV shows in parallel
  const promises = tmdbIds.map(async (id) => {
    const show = await fetchTVShowDetails(id, includeVideos);
    if (show) {
      results.set(id, show);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Batch fetch mixed content (movies and TV shows) in parallel (PERFORMANCE OPTIMIZED)
 */
export async function fetchMultipleContent(
  items: Array<{ tmdbId: number; type: 'movie' | 'tv' | 'anime' }>,
  includeVideos: boolean = false
): Promise<Map<number, TMDBMovie | TMDBTVShow>> {
  const results = new Map<number, TMDBMovie | TMDBTVShow>();

  // Fetch all content in parallel
  const promises = items.map(async (item) => {
    const isTVContent = item.type === 'tv' || item.type === 'anime';
    const data = isTVContent
      ? await fetchTVShowDetails(item.tmdbId, includeVideos)
      : await fetchMovieDetails(item.tmdbId, includeVideos);

    if (data) {
      results.set(item.tmdbId, data);
    }
  });

  await Promise.all(promises);
  return results;
}
