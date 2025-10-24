-- Script to add dummy watch history data for testing
-- Run this in your Supabase SQL Editor
-- Make sure to replace 'YOUR_PROFILE_ID' and 'YOUR_CONTENT_IDS' with actual values

-- First, check your profile ID
-- SELECT id, name FROM profiles LIMIT 1;

-- Then, get some content IDs
-- SELECT id, tmdb_id, content_type FROM content LIMIT 10;

-- Example: Add dummy watch history for testing
-- Replace the UUIDs below with your actual profile_id and content IDs

-- Movie at 30% progress (30 minutes watched of 100 minute movie)
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, episode_id, season_number, episode_number, updated_at)
VALUES (
  'YOUR_PROFILE_ID', -- Replace with actual profile ID
  'CONTENT_ID_1',    -- Replace with actual content ID (movie)
  1800,              -- 30 minutes in seconds
  6000,              -- 100 minutes in seconds
  NULL,
  NULL,
  NULL,
  NOW() - INTERVAL '2 hours'
)
ON CONFLICT (profile_id, content_uuid)
DO UPDATE SET
  last_position = EXCLUDED.last_position,
  duration = EXCLUDED.duration,
  updated_at = EXCLUDED.updated_at;

-- Movie at 75% progress (90 minutes watched of 120 minute movie)
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, episode_id, season_number, episode_number, updated_at)
VALUES (
  'YOUR_PROFILE_ID',
  'CONTENT_ID_2',
  5400,  -- 90 minutes
  7200,  -- 120 minutes
  NULL,
  NULL,
  NULL,
  NOW() - INTERVAL '5 hours'
)
ON CONFLICT (profile_id, content_uuid)
DO UPDATE SET
  last_position = EXCLUDED.last_position,
  duration = EXCLUDED.duration,
  updated_at = EXCLUDED.updated_at;

-- TV Show - Season 1, Episode 3 at 60% (25 minutes watched of 42 minute episode)
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, episode_id, season_number, episode_number, updated_at)
VALUES (
  'YOUR_PROFILE_ID',
  'CONTENT_ID_3',  -- Must be a TV show
  1500,  -- 25 minutes
  2500,  -- ~42 minutes
  NULL,
  1,     -- Season 1
  3,     -- Episode 3
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (profile_id, content_uuid)
DO UPDATE SET
  last_position = EXCLUDED.last_position,
  duration = EXCLUDED.duration,
  season_number = EXCLUDED.season_number,
  episode_number = EXCLUDED.episode_number,
  updated_at = EXCLUDED.updated_at;

-- TV Show - Season 2, Episode 1 at 15% (10 minutes watched of 67 minute episode)
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, episode_id, season_number, episode_number, updated_at)
VALUES (
  'YOUR_PROFILE_ID',
  'CONTENT_ID_4',
  600,   -- 10 minutes
  4000,  -- ~67 minutes
  NULL,
  2,     -- Season 2
  1,     -- Episode 1
  NOW() - INTERVAL '3 days'
)
ON CONFLICT (profile_id, content_uuid)
DO UPDATE SET
  last_position = EXCLUDED.last_position,
  duration = EXCLUDED.duration,
  season_number = EXCLUDED.season_number,
  episode_number = EXCLUDED.episode_number,
  updated_at = EXCLUDED.updated_at;

-- Anime - Season 1, Episode 5 at 40% (16 minutes watched of 40 minute episode)
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, episode_id, season_number, episode_number, updated_at)
VALUES (
  'YOUR_PROFILE_ID',
  'CONTENT_ID_5',  -- Must be anime type
  960,   -- 16 minutes
  2400,  -- 40 minutes
  NULL,
  1,     -- Season 1
  5,     -- Episode 5
  NOW() - INTERVAL '12 hours'
)
ON CONFLICT (profile_id, content_uuid)
DO UPDATE SET
  last_position = EXCLUDED.last_position,
  duration = EXCLUDED.duration,
  season_number = EXCLUDED.season_number,
  episode_number = EXCLUDED.episode_number,
  updated_at = EXCLUDED.updated_at;

-- Verify the data was inserted
SELECT
  cw.*,
  c.content_type,
  ROUND((cw.last_position::numeric / cw.duration) * 100) as progress_percent
FROM continue_watching cw
JOIN content c ON c.id = cw.content_uuid
WHERE cw.profile_id = 'YOUR_PROFILE_ID'
ORDER BY cw.updated_at DESC;
