/**
 * Script to add dummy watch history data for testing
 * Run this with: npx tsx scripts/add-dummy-watch-history.ts
 *
 * You'll need to install tsx: npm install -D tsx
 */

import { createClient } from '@supabase/supabase-js';

// Replace with your Supabase URL and anon key
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function addDummyWatchHistory() {
  console.log('🎬 Adding dummy watch history data...\n');

  // First, get the current profile
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name')
    .limit(1);

  if (profileError || !profiles || profiles.length === 0) {
    console.error('❌ Error getting profile:', profileError);
    console.log('Please create a profile first in the app');
    return;
  }

  const profileId = profiles[0].id;
  console.log(`✅ Using profile: ${profiles[0].name} (${profileId})\n`);

  // Get some content from the database
  const { data: content, error: contentError } = await supabase
    .from('content')
    .select('id, tmdb_id, content_type')
    .limit(10);

  if (contentError || !content || content.length === 0) {
    console.error('❌ Error getting content:', contentError);
    return;
  }

  console.log(`✅ Found ${content.length} content items\n`);

  // Add watch progress for first 5 items
  const watchHistoryData = [
    {
      // Movie at 30% progress
      profile_id: profileId,
      content_uuid: content[0].id,
      last_position: 1800, // 30 minutes
      duration: 6000, // 100 minutes
      episode_id: null,
      season_number: null,
      episode_number: null,
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    },
    {
      // Movie at 75% progress
      profile_id: profileId,
      content_uuid: content[1].id,
      last_position: 5400, // 90 minutes
      duration: 7200, // 120 minutes
      episode_id: null,
      season_number: null,
      episode_number: null,
      updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    },
    {
      // TV Show - Season 1, Episode 3 at 60%
      profile_id: profileId,
      content_uuid: content[2].id,
      last_position: 1500, // 25 minutes
      duration: 2500, // ~42 minutes
      episode_id: null, // You can add actual episode IDs if you have them
      season_number: 1,
      episode_number: 3,
      updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    },
    {
      // TV Show - Season 2, Episode 1 at 15%
      profile_id: profileId,
      content_uuid: content[3].id,
      last_position: 600, // 10 minutes
      duration: 4000, // ~67 minutes
      episode_id: null,
      season_number: 2,
      episode_number: 1,
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    },
    {
      // Anime - Season 1, Episode 5 at 40%
      profile_id: profileId,
      content_uuid: content[4].id,
      last_position: 960, // 16 minutes
      duration: 2400, // 40 minutes
      episode_id: null,
      season_number: 1,
      episode_number: 5,
      updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    },
  ];

  console.log('📝 Inserting watch history records...\n');

  for (const record of watchHistoryData) {
    const { error } = await supabase
      .from('continue_watching')
      .upsert(record, {
        onConflict: 'profile_id,content_uuid',
      });

    if (error) {
      console.error(`❌ Error inserting record for content ${record.content_uuid}:`, error.message);
    } else {
      const progressPercent = Math.round((record.last_position / record.duration) * 100);
      const contentInfo = content.find(c => c.id === record.content_uuid);
      const episodeInfo = record.season_number && record.episode_number
        ? ` - S${record.season_number}E${record.episode_number}`
        : '';
      console.log(`✅ Added ${contentInfo?.content_type}${episodeInfo} - ${progressPercent}% watched`);
    }
  }

  console.log('\n🎉 Done! Check your Continue Watching section in the app.');
  console.log('The items should appear sorted by most recently watched.\n');
}

// Run the script
addDummyWatchHistory()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
