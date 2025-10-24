/**
 * Script to add tags to content in the database
 *
 * This script helps populate the tags array for content items.
 * Tags are searchable keywords that users might use to find content.
 *
 * Usage:
 * 1. Update the CONTENT_TAGS object below with tmdb_id and tags
 * 2. Run: npx tsx scripts/add-tags-to-content.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Define tags for your content here
 * Format: { tmdb_id: [array of tags] }
 *
 * Tips for creating good tags:
 * - Movie/show titles and alternate names
 * - Actor names
 * - Director names
 * - Genre keywords
 * - Famous quotes or catchphrases
 * - Character names
 * - Common misspellings
 * - Abbreviations (e.g., "lotr" for "lord of the rings")
 */
const CONTENT_TAGS: Record<number, string[]> = {
  // Examples (already added):
  278: ['shawshank', 'redemption', 'prison', 'drama', 'morgan freeman', 'tim robbins'],
  238: ['godfather', 'mafia', 'corleone', 'don vito', 'al pacino', 'marlon brando', 'italian mob'],
  424: ['schindlers list', 'schindler', 'holocaust', 'world war', 'wwii', 'liam neeson', 'spielberg'],
  550: ['fight club', 'tyler durden', 'brad pitt', 'edward norton', 'soap', 'project mayhem'],
  155: ['dark knight', 'batman', 'joker', 'heath ledger', 'christian bale', 'gotham', 'bruce wayne'],

  // Add your content tags below:
  // tmdb_id: ['tag1', 'tag2', 'tag3'],
};

async function addTagsToContent() {
  console.log('Starting to add tags to content...\n');

  let successCount = 0;
  let errorCount = 0;
  let notFoundCount = 0;

  for (const [tmdbId, tags] of Object.entries(CONTENT_TAGS)) {
    try {
      // Check if content exists
      const { data: content, error: fetchError } = await supabase
        .from('content')
        .select('id, tmdb_id, content_type')
        .eq('tmdb_id', parseInt(tmdbId))
        .single();

      if (fetchError || !content) {
        console.log(`⚠️  Content with TMDB ID ${tmdbId} not found in database`);
        notFoundCount++;
        continue;
      }

      // Update tags
      const { error: updateError } = await supabase
        .from('content')
        .update({ tags })
        .eq('tmdb_id', parseInt(tmdbId));

      if (updateError) {
        console.error(`❌ Error updating tags for TMDB ID ${tmdbId}:`, updateError.message);
        errorCount++;
      } else {
        console.log(`✅ Added ${tags.length} tags to content (TMDB ID: ${tmdbId}, Type: ${content.content_type})`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Unexpected error for TMDB ID ${tmdbId}:`, err);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Summary:`);
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`⚠️  Not found in database: ${notFoundCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(50));
}

// Alternatively, fetch from TMDB and auto-generate tags
async function autoGenerateTags(limit = 10) {
  console.log(`Auto-generating tags for ${limit} content items...\n`);

  // Fetch content without tags
  const { data: contentList, error } = await supabase
    .from('content')
    .select('id, tmdb_id, content_type, tags')
    .or('tags.is.null,tags.eq.{}')
    .limit(limit);

  if (error) {
    console.error('Error fetching content:', error);
    return;
  }

  if (!contentList || contentList.length === 0) {
    console.log('No content found without tags');
    return;
  }

  console.log(`Found ${contentList.length} content items without tags\n`);

  for (const content of contentList) {
    try {
      // Fetch TMDB details
      const tmdbUrl = content.content_type === 'movie'
        ? `https://api.themoviedb.org/3/movie/${content.tmdb_id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=en-US&append_to_response=credits`
        : `https://api.themoviedb.org/3/tv/${content.tmdb_id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=en-US&append_to_response=credits`;

      const response = await fetch(tmdbUrl);
      if (!response.ok) continue;

      const tmdbData = await response.json();
      const tags: string[] = [];

      // Add title variations
      const title = (tmdbData.title || tmdbData.name || '').toLowerCase();
      if (title) {
        tags.push(title);
        // Add words from title
        tags.push(...title.split(' ').filter(word => word.length > 2));
      }

      // Add original title if different
      const originalTitle = (tmdbData.original_title || tmdbData.original_name || '').toLowerCase();
      if (originalTitle && originalTitle !== title) {
        tags.push(originalTitle);
      }

      // Add top 5 cast members
      if (tmdbData.credits?.cast) {
        const topCast = tmdbData.credits.cast.slice(0, 5);
        tags.push(...topCast.map((actor: any) => actor.name.toLowerCase()));
      }

      // Add director/creator
      if (tmdbData.credits?.crew) {
        const directors = tmdbData.credits.crew.filter((person: any) => person.job === 'Director');
        tags.push(...directors.map((director: any) => director.name.toLowerCase()));
      }

      // Add genre keywords
      if (tmdbData.genres) {
        tags.push(...tmdbData.genres.map((genre: any) => genre.name.toLowerCase()));
      }

      // Remove duplicates and update
      const uniqueTags = [...new Set(tags)];

      const { error: updateError } = await supabase
        .from('content')
        .update({ tags: uniqueTags })
        .eq('id', content.id);

      if (updateError) {
        console.error(`❌ Error updating ${title}:`, updateError.message);
      } else {
        console.log(`✅ Added ${uniqueTags.length} auto-generated tags to: ${title}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (err) {
      console.error(`❌ Error processing content ${content.tmdb_id}:`, err);
    }
  }
}

// Run the script
const mode = process.argv[2] || 'manual';

if (mode === 'auto') {
  const limit = parseInt(process.argv[3] || '10');
  autoGenerateTags(limit).catch(console.error);
} else {
  addTagsToContent().catch(console.error);
}
