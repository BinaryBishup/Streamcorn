# Quick Start: Add Dummy Watch History

## Step-by-Step Guide

### Step 1: Get Your Profile ID

Open Supabase SQL Editor and run:

```sql
SELECT id, name FROM profiles ORDER BY created_at DESC LIMIT 1;
```

Copy the `id` value. Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### Step 2: Get Content IDs

```sql
SELECT id, tmdb_id, content_type
FROM content
LIMIT 10;
```

Copy at least 5 content `id` values for testing.

### Step 3: Add Watch History

Replace `YOUR_PROFILE_ID` and `CONTENT_ID_X` with actual values from steps 1 & 2:

```sql
-- Movie 1: 30% watched (recent)
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, updated_at)
VALUES (
  'YOUR_PROFILE_ID',
  'CONTENT_ID_1',
  1800,  -- 30 min watched
  6000,  -- 100 min total
  NOW() - INTERVAL '2 hours'
);

-- Movie 2: 75% watched
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, updated_at)
VALUES (
  'YOUR_PROFILE_ID',
  'CONTENT_ID_2',
  5400,  -- 90 min watched
  7200,  -- 120 min total
  NOW() - INTERVAL '5 hours'
);

-- TV Show: S1E3 at 60%
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, season_number, episode_number, updated_at)
VALUES (
  'YOUR_PROFILE_ID',
  'CONTENT_ID_3',
  1500,  -- 25 min watched
  2500,  -- 42 min total
  1,     -- Season 1
  3,     -- Episode 3
  NOW() - INTERVAL '1 day'
);

-- TV Show: S2E1 at 15%
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, season_number, episode_number, updated_at)
VALUES (
  'YOUR_PROFILE_ID',
  'CONTENT_ID_4',
  600,   -- 10 min watched
  4000,  -- 67 min total
  2,     -- Season 2
  1,     -- Episode 1
  NOW() - INTERVAL '3 days'
);

-- Anime: S1E5 at 40%
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, season_number, episode_number, updated_at)
VALUES (
  'YOUR_PROFILE_ID',
  'CONTENT_ID_5',
  960,   -- 16 min watched
  2400,  -- 40 min total
  1,     -- Season 1
  5,     -- Episode 5
  NOW() - INTERVAL '12 hours'
);
```

### Step 4: Verify

```sql
SELECT
  cw.id,
  c.content_type,
  cw.season_number,
  cw.episode_number,
  ROUND((cw.last_position::numeric / cw.duration) * 100) as progress_percent,
  cw.updated_at
FROM continue_watching cw
JOIN content c ON c.id = cw.content_uuid
WHERE cw.profile_id = 'YOUR_PROFILE_ID'
ORDER BY cw.updated_at DESC;
```

You should see 5 rows with progress percentages.

### Step 5: Check the App

1. Refresh your app's home page
2. You should see "Continue Watching" section
3. Items should appear sorted by most recent
4. Movies show just the progress bar
5. TV shows/anime show "S#:E#" format

## Time Conversion Reference

When setting `last_position` and `duration`:

```
Seconds → Minutes
------------------
60 sec = 1 min
600 sec = 10 min
1200 sec = 20 min
1800 sec = 30 min
2400 sec = 40 min
3000 sec = 50 min
3600 sec = 60 min (1 hour)
5400 sec = 90 min (1.5 hours)
7200 sec = 120 min (2 hours)
```

## Common Progress Percentages

```
10% of 60 min movie = 360 / 3600
25% of 90 min movie = 1350 / 5400
50% of 120 min movie = 3600 / 7200
75% of 40 min episode = 1800 / 2400
90% of 45 min episode = 2430 / 2700
```

## Example with Real Data

Let's say you have:
- Profile ID: `123e4567-e89b-12d3-a456-426614174000`
- Content IDs from your database:
  - `content-id-1` (The Godfather - movie)
  - `content-id-2` (Breaking Bad - tv)

```sql
-- The Godfather at 45 minutes (25% of 175 min movie)
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, updated_at)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'content-id-1',
  2700,   -- 45 minutes
  10500,  -- 175 minutes
  NOW() - INTERVAL '1 hour'
);

-- Breaking Bad S1E1 at 30 minutes (60% of 50 min episode)
INSERT INTO continue_watching (profile_id, content_uuid, last_position, duration, season_number, episode_number, updated_at)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'content-id-2',
  1800,  -- 30 minutes
  3000,  -- 50 minutes
  1,     -- Season 1
  1,     -- Episode 1
  NOW() - INTERVAL '30 minutes'
);
```

Now your Continue Watching will show:
1. Breaking Bad S1:E1 (60% complete) - watched 30 min ago
2. The Godfather (25% complete) - watched 1 hour ago

## Troubleshooting

**Q: Items not appearing?**
- Check profile_id matches your current profile
- Verify content_uuid exists in content table
- Make sure last_position and duration are > 0

**Q: Wrong order?**
- Items are sorted by `updated_at` DESC (most recent first)
- Use different intervals in your INSERT statements

**Q: No episode info for TV shows?**
- Ensure season_number and episode_number are set (not NULL)
- Verify content_type is 'tv' or 'anime'

**Q: Progress bar wrong?**
- Check: (last_position / duration) * 100 = expected %
- All times should be in seconds
- Duration must be greater than last_position
