# Content Tags Guide

## Overview

The `tags` column in the `content` table enables powerful search functionality by storing searchable keywords and aliases for each piece of content. Users can find content by searching for any tag, including alternate names, actor names, character names, or any other relevant keywords.

## How It Works

### Database Schema

- **Column**: `tags` (text array)
- **Index**: GIN index for fast array searches
- **Default**: Empty array `[]`

### Search Logic

The search page (`/app/search/page.tsx`) works as follows:

1. User enters a search query
2. System searches the database for content where any tag contains the search term
3. Matching content is retrieved from the database
4. TMDB metadata (images, ratings) is fetched for display
5. Results are shown to the user

**Key Benefits:**
- Fast database-first search
- No need to search TMDB every time
- Customizable search terms
- Works with partial matches (e.g., "batman" matches "the dark knight")

## Adding Tags

### Method 1: Manual Script

Edit `scripts/add-tags-to-content.ts` and add entries to the `CONTENT_TAGS` object:

```typescript
const CONTENT_TAGS: Record<number, string[]> = {
  155: ['dark knight', 'batman', 'joker', 'heath ledger', 'christian bale', 'gotham', 'bruce wayne'],
  // Add more...
};
```

Run the script:
```bash
npx tsx scripts/add-tags-to-content.ts
```

### Method 2: Auto-Generate Tags

The script can automatically generate tags from TMDB data:

```bash
# Auto-generate tags for 10 content items without tags
npx tsx scripts/add-tags-to-content.ts auto 10

# Process more items
npx tsx scripts/add-tags-to-content.ts auto 50
```

Auto-generated tags include:
- Title and original title
- Top 5 cast members
- Directors/creators
- Genre keywords

### Method 3: Direct SQL

Update tags directly via SQL:

```sql
UPDATE content
SET tags = ARRAY['inception', 'christopher nolan', 'leonardo dicaprio', 'dreams', 'cobb']
WHERE tmdb_id = 27205;
```

## Tag Best Practices

### What Makes Good Tags?

1. **Title Variations**
   - Official title: "The Lord of the Rings"
   - Abbreviations: "lotr", "lord of the rings"
   - Alternate names: "fellowship", "two towers", "return of the king"

2. **People**
   - Main actors: "tom hanks", "meryl streep"
   - Directors: "christopher nolan", "spielberg"
   - Character names: "tony stark", "iron man"

3. **Genre & Themes**
   - "superhero", "romance", "thriller"
   - "space", "detective", "heist"

4. **Popular Search Terms**
   - Famous quotes: "may the force"
   - Catchphrases: "i am groot"
   - Memorable scenes: "red wedding"

5. **Common Misspellings**
   - "schindlers list", "shindler"
   - "governator" for Arnold Schwarzenegger

### Tag Guidelines

- ✅ Use lowercase for consistency
- ✅ Include both full names and parts ("robert downey jr", "robert downey", "rdj")
- ✅ Add multiple language variations if relevant
- ✅ Include series/franchise names ("mcu", "marvel", "avengers")
- ❌ Avoid overly generic tags ("movie", "good")
- ❌ Don't duplicate exact title (it's already searchable via TMDB)

## Examples

### Movie: The Shawshank Redemption (TMDB ID: 278)
```typescript
tags: [
  'shawshank',
  'redemption',
  'prison',
  'drama',
  'morgan freeman',
  'tim robbins',
  'andy dufresne',
  'red',
  'zihuatanejo',
  'hope'
]
```

### TV Show: Breaking Bad (TMDB ID: 1396)
```typescript
tags: [
  'breaking bad',
  'heisenberg',
  'walter white',
  'jesse pinkman',
  'bryan cranston',
  'aaron paul',
  'meth',
  'chemistry',
  'albuquerque',
  'say my name'
]
```

### Anime: Death Note (TMDB ID: 1535)
```typescript
tags: [
  'death note',
  'light yagami',
  'l',
  'kira',
  'ryuk',
  'shinigami',
  'detective',
  'psychological',
  'anime',
  'manga'
]
```

## Bulk Tag Population

To populate tags for all existing content:

### Step 1: Export Content List
```sql
SELECT tmdb_id, content_type FROM content WHERE tags = '{}' OR tags IS NULL;
```

### Step 2: Use Auto-Generation
Process content in batches to avoid rate limiting:

```bash
# Process 50 at a time
npx tsx scripts/add-tags-to-content.ts auto 50
# Wait a few minutes, then run again
npx tsx scripts/add-tags-to-content.ts auto 50
```

### Step 3: Manual Enhancement
Review and enhance auto-generated tags with:
- Character names
- Famous quotes
- Common misspellings
- Abbreviations

## Monitoring & Maintenance

### Check Coverage
```sql
-- Count content without tags
SELECT COUNT(*) FROM content WHERE tags = '{}' OR tags IS NULL;

-- Count content with tags
SELECT COUNT(*) FROM content WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

-- View content with most tags
SELECT tmdb_id, content_type, array_length(tags, 1) as tag_count
FROM content
WHERE tags IS NOT NULL
ORDER BY tag_count DESC
LIMIT 10;
```

### Update Strategy
- Add tags when importing new content
- Periodically review search analytics to identify missing tags
- Update tags based on user search queries that return no results

## Search Performance

The GIN index on the `tags` column ensures fast searches even with:
- Large content libraries (10,000+ items)
- Multiple tags per item (20+ tags)
- Partial string matching

**Typical query performance:**
- < 50ms for databases with 1,000 content items
- < 100ms for databases with 10,000+ content items

## Troubleshooting

### Search Returns No Results

1. Check if content has tags:
   ```sql
   SELECT tags FROM content WHERE tmdb_id = YOUR_TMDB_ID;
   ```

2. Verify search term matches a tag:
   ```sql
   SELECT * FROM content WHERE 'batman' = ANY(tags);
   ```

3. Test with partial match:
   ```sql
   SELECT * FROM content WHERE EXISTS (
     SELECT 1 FROM unnest(tags) AS tag WHERE tag LIKE '%batman%'
   );
   ```

### Tags Not Updating

- Clear browser cache
- Check Supabase dashboard for RLS policies
- Verify script ran successfully
- Check for SQL errors in migration

## Future Enhancements

Potential improvements to consider:

1. **Full-Text Search**: Upgrade to PostgreSQL full-text search for better ranking
2. **Tag Analytics**: Track which tags users search for most
3. **Smart Suggestions**: Suggest tags based on TMDB data and user behavior
4. **Multi-Language**: Add tags in multiple languages
5. **User Contributions**: Allow users to suggest tags
