# Bunny CDN Setup for TMDB Images

## Problem
TMDB (themoviedb.org) is blocked by JIO and some other ISPs in India, preventing users from loading movie posters, backdrops, and logos.

## Solution
Use Bunny CDN as a proxy/cache for TMDB images. Users connect to Bunny CDN instead of TMDB directly.

## Setup Instructions

### 1. Create Bunny CDN Pull Zone

1. Go to [Bunny.net](https://bunny.net) and create an account
2. Navigate to **CDN** → **Add Pull Zone**
3. Fill in the configuration:

```
Pull Zone Name: streamcorn_images
Origin Type: Origin URL
Origin URL: image.tmdb.org
Host header (optional): image.tmdb.org
Choose tier: High Volume Tier (recommended for streaming platforms)
```

4. Click **Add Pull Zone**

### 2. Get Your CDN URL

After creation, you'll receive a CDN hostname like:
```
streamcorn_images.b-cdn.net
```

### 3. Update Environment Variable

Update `.env.local`:
```bash
NEXT_PUBLIC_TMDB_IMAGE_BASE_URL=https://streamcorn_images.b-cdn.net/t/p
```

Replace `streamcorn_images` with your actual pull zone name.

### 4. Restart Development Server

```bash
npm run dev
```

## How It Works

```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│  User    │────▶│  Bunny CDN   │────▶│  TMDB    │
│ (India)  │◀────│  (Cached)    │◀────│ Images   │
└──────────┘     └──────────────┘     └──────────┘
```

1. **First Request**: User requests image → Bunny CDN fetches from TMDB → Caches it → Serves to user
2. **Subsequent Requests**: User requests image → Bunny CDN serves from cache (super fast!)

## Benefits

✅ **Bypasses JIO blocking** - Users access Bunny, not TMDB
✅ **Faster delivery** - Bunny has Indian PoPs (Point of Presence)
✅ **Lower bandwidth** - Cached images reduce TMDB API usage
✅ **Better performance** - CDN optimization and compression
✅ **Cost effective** - Bunny CDN is very affordable (~$5-20/month)

## Cost Estimate

For a streaming platform with ~1000 daily active users:

- Storage: ~$0.01/GB/month
- Bandwidth: ~$0.01/GB (India region)
- First 500k requests: Free

**Estimated monthly cost: $5-20**

## Verification

After setup, all image URLs will automatically use Bunny CDN:

```typescript
// Before: https://image.tmdb.org/t/p/w500/poster.jpg
// After:  https://streamcorn_images.b-cdn.net/t/p/w500/poster.jpg
```

Check browser DevTools → Network tab to verify image requests go to `b-cdn.net`

## Troubleshooting

**Images not loading:**
1. Check pull zone is created correctly
2. Verify environment variable is updated
3. Ensure dev server was restarted after .env change
4. Check Bunny CDN dashboard for any errors

**Still seeing TMDB URLs:**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. Check that .env.local has the correct URL

## Optional: Custom Domain

For branding, you can use a custom domain (e.g., `cdn.streamcorn.com`):

1. In Bunny CDN dashboard → Pull Zone Settings → Hostnames
2. Add custom hostname
3. Update DNS CNAME record
4. Update `.env.local` with custom domain

## Support

For Bunny CDN support: https://support.bunny.net/
For setup issues: Check the Bunny CDN dashboard logs
