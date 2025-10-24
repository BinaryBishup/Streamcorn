# Watch History & Continue Watching System

## Overview

The watch history system tracks user viewing progress across movies, TV shows, and anime. It allows users to resume watching content from where they left off.

## Database Schema

### `continue_watching` Table

```sql
Table: continue_watching
├── id (uuid, primary key)
├── profile_id (uuid, foreign key -> profiles.id)
├── content_uuid (uuid, foreign key -> content.id)
├── last_position (integer) - Position in seconds where user stopped
├── duration (integer) - Total content duration in seconds
├── episode_id (uuid, nullable) - For TV shows/anime episodes
├── season_number (integer, nullable) - For TV shows/anime
├── episode_number (integer, nullable) - For TV shows/anime
├── updated_at (timestamp) - Last watch time
└── UNIQUE CONSTRAINT on (profile_id, content_uuid)
```

## How It Works

### 1. **Tracking Watch Progress**

When a user watches content:
- **Movies**: Track position and duration
- **TV Shows/Anime**: Track position, duration, season, and episode numbers

```typescript
// Example: Update watch progress
await updateWatchProgress(
  contentId,        // UUID of the content
  profileId,        // UUID of the profile
  1800,            // Position in seconds (30 minutes)
  6000,            // Duration in seconds (100 minutes)
  null,            // Episode ID (for TV shows)
  1,               // Season number (for TV shows)
  5                // Episode number (for TV shows)
);
```

### 2. **Continue Watching Section**

The "Continue Watching" row displays:
- Most recently watched content (sorted by `updated_at` DESC)
- Progress bar showing completion percentage
- For TV shows: "S1:E5" format
- Automatically updates when user watches more

### 3. **Progress Calculation**

```typescript
Progress % = (last_position / duration) * 100

// Example:
// Watched 30 minutes of 100 minute movie
// Progress = (1800 / 6000) * 100 = 30%
```

### 4. **Content Completion**

Content is considered "completed" when:
- User reaches within 120 seconds (2 minutes) of the end
- Can be configured with the `threshold` parameter

```typescript
isContentCompleted(position, duration, threshold = 120)
```

## Adding Dummy Data for Testing

### Option 1: TypeScript Script

```bash
# Install dependencies if needed
npm install -D tsx

# Run the script
npx tsx scripts/add-dummy-watch-history.ts
```

### Option 2: SQL Script (Recommended)

1. Open Supabase SQL Editor
2. Get your profile ID:
   ```sql
   SELECT id, name FROM profiles LIMIT 1;
   ```

3. Get content IDs:
   ```sql
   SELECT id, tmdb_id, content_type FROM content LIMIT 10;
   ```

4. Run the SQL script at `scripts/add-dummy-watch-history.sql` with your IDs

### Option 3: Manual Insert

```sql
INSERT INTO continue_watching (
  profile_id,
  content_uuid,
  last_position,
  duration,
  season_number,
  episode_number,
  updated_at
) VALUES (
  'your-profile-id',
  'content-id',
  1800,  -- 30 minutes watched
  6000,  -- 100 minutes total
  1,     -- Season 1 (for TV shows)
  3,     -- Episode 3 (for TV shows)
  NOW()
);
```

## Example Data

Here are example scenarios:

### Movie (30% watched)
```sql
last_position: 1800 (30 minutes)
duration: 6000 (100 minutes)
season_number: null
episode_number: null
```

### TV Show (Season 2, Episode 5 at 75%)
```sql
last_position: 1800 (30 minutes)
duration: 2400 (40 minutes)
season_number: 2
episode_number: 5
```

### Anime (Season 1, Episode 10 at 50%)
```sql
last_position: 1200 (20 minutes)
duration: 2400 (40 minutes)
season_number: 1
episode_number: 10
```

## API Functions

### `getWatchProgress(contentId, profileId)`
Get watch progress for specific content and profile.

### `updateWatchProgress(contentId, profileId, position, duration, ...)`
Update or create watch progress entry.

### `getContinueWatching(profileId, limit)`
Get all continue watching items for a profile, sorted by most recent.

### `calculateProgress(position, duration)`
Calculate progress percentage (0-100).

### `isContentCompleted(position, duration, threshold)`
Check if content is completed (within threshold of end).

### `getNextEpisode(contentId, seasonNumber, episodeNumber)`
Get the next episode to watch for TV shows.

## Testing the Feature

1. **Add dummy data** using one of the methods above
2. **Navigate to home page** - You should see "Continue Watching" row
3. **Verify**:
   - Items appear in correct order (most recent first)
   - Progress bars show correctly
   - TV shows display "S#:E#" format
   - Clicking resumes playback

## Tips

- **Position values** are in seconds (e.g., 1800 = 30 minutes)
- **Duration values** are in seconds (e.g., 6000 = 100 minutes)
- **updated_at** determines sort order in Continue Watching
- Use **season_number** and **episode_number** for TV shows and anime
- Leave them **null** for movies

## Troubleshooting

### Continue Watching section doesn't appear
- Check that you have watch progress data in `continue_watching` table
- Verify `profile_id` matches your current profile
- Check that `content_uuid` matches valid content IDs in `content` table

### Progress bar not showing
- Verify `last_position` and `duration` are valid numbers
- Check that duration > 0
- Ensure both values are in seconds

### TV show episode info not showing
- Make sure `season_number` and `episode_number` are set
- Verify content_type is "tv" or "anime"
- Check that the content exists in database
