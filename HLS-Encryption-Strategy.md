# HLS Encryption & Streaming Strategy

## Overview
Transcode multi-audio/subtitle MP4 → Encrypted HLS → Store on Wasabi → Serve via BunnyCDN → Single key in player

---

## 1. Input File
```
input.mp4
├── Video track (1080p)
├── Audio track 1 (English)
├── Audio track 2 (Spanish)
├── Subtitle track 1 (English)
└── Subtitle track 2 (Spanish)
```

---

## 2. Generate Encryption Key (One-Time Setup)

```bash
# Generate a random 16-byte key (AES-128)
openssl rand 16 > encryption.key

# Generate key as hex string (for player)
openssl rand -hex 16
# Output: 3a7f9c2e1d4b8a6f5e3c9d7a2b4e6f8a

# Generate IV (Initialization Vector)
openssl rand -hex 16
# Output: 1f2e3d4c5b6a7988776655443322110
```

**Save these values:**
- `encryption.key` - Binary key file (for ffmpeg)
- Hex key: `3a7f9c2e1d4b8a6f5e3c9d7a2b4e6f8a` (for player)
- Hex IV: `1f2e3d4c5b6a7988776655443322110` (for m3u8)

---

## 3. Transcoding with FFmpeg

### Create key_info file
```bash
# key_info.txt
https://dummy-url.com/key.bin
encryption.key
1f2e3d4c5b6a7988776655443322110
```
**Note:** The URL doesn't matter (we'll handle keys in player), but ffmpeg requires it.

### Transcode Command
```bash
ffmpeg -i input.mp4 \
  -map 0:v:0 -map 0:a:0 -map 0:a:1 \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -hls_time 10 \
  -hls_playlist_type vod \
  -hls_segment_type mpegts \
  -hls_key_info_file key_info.txt \
  -hls_segment_filename "segment_%03d.ts" \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0,name:english v:0,a:1,name:spanish" \
  stream_%v/playlist.m3u8
```

### For Subtitles (WebVTT)
```bash
# Extract subtitles separately
ffmpeg -i input.mp4 -map 0:s:0 english.vtt
ffmpeg -i input.mp4 -map 0:s:1 spanish.vtt
```

---

## 4. Output File Structure

```
video_123/
├── master.m3u8              (Multi-audio master playlist)
├── stream_english/
│   ├── playlist.m3u8        (English audio variant)
│   ├── segment_000.ts       (Encrypted)
│   ├── segment_001.ts       (Encrypted)
│   └── segment_002.ts       (Encrypted)
├── stream_spanish/
│   ├── playlist.m3u8        (Spanish audio variant)
│   ├── segment_000.ts       (Encrypted)
│   ├── segment_001.ts       (Encrypted)
│   └── segment_002.ts       (Encrypted)
├── english.vtt              (Subtitle - not encrypted)
└── spanish.vtt              (Subtitle - not encrypted)
```

---

## 5. Storage Strategy

### On Wasabi (Only encrypted segments)
```
s3://your-bucket/videos/
└── video_123/
    ├── stream_english/
    │   ├── segment_000.ts
    │   ├── segment_001.ts
    │   └── segment_002.ts
    ├── stream_spanish/
    │   ├── segment_000.ts
    │   ├── segment_001.ts
    │   └── segment_002.ts
    ├── english.vtt
    └── spanish.vtt
```

**Upload command:**
```bash
aws s3 cp video_123/ s3://your-bucket/videos/video_123/ --recursive \
  --exclude "*.m3u8" \
  --endpoint-url=https://s3.wasabisys.com
```

### On Your Server (Database + Playlists)
```sql
-- videos table
CREATE TABLE videos (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255),
  encryption_key VARCHAR(32),  -- Hex key (not recommended, see note)
  encryption_iv VARCHAR(32),    -- Hex IV
  wasabi_path VARCHAR(255),
  cdn_base_url VARCHAR(255)
);

INSERT INTO videos VALUES (
  'video_123',
  'Sample Movie',
  '3a7f9c2e1d4b8a6f5e3c9d7a2b4e6f8a',
  '1f2e3d4c5b6a7988776655443322110',
  'videos/video_123',
  'https://your-cdn.b-cdn.net/videos/video_123'
);
```

**Security Note:** Storing keys in DB is a risk. Better options:
- Environment variables
- Secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Encrypted at rest in DB

---

## 6. Dynamic M3U8 Generation (Your API)

### Master Playlist Endpoint
```
GET /api/video/video_123/master.m3u8
```

**Generated master.m3u8:**
```m3u8
#EXTM3U
#EXT-X-VERSION:3

#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",DEFAULT=YES,LANGUAGE="en",URI="https://your-cdn.b-cdn.net/videos/video_123/stream_english/playlist.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Spanish",DEFAULT=NO,LANGUAGE="es",URI="https://your-cdn.b-cdn.net/videos/video_123/stream_spanish/playlist.m3u8"

#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",DEFAULT=YES,LANGUAGE="en",URI="https://your-cdn.b-cdn.net/videos/video_123/english.vtt"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Spanish",DEFAULT=NO,LANGUAGE="es",URI="https://your-cdn.b-cdn.net/videos/video_123/spanish.vtt"

#EXT-X-STREAM-INF:BANDWIDTH=2000000,AUDIO="audio",SUBTITLES="subs"
https://your-cdn.b-cdn.net/videos/video_123/stream_english/playlist.m3u8
```

### Variant Playlist (modify on-the-fly)
**Original playlist.m3u8 from ffmpeg:**
```m3u8
#EXT-X-KEY:METHOD=AES-128,URI="https://dummy-url.com/key.bin",IV=0x1f2e3d4c5b6a7988776655443322110
#EXTINF:10.0,
segment_000.ts
```

**Modified by your server (add CDN URLs):**
```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD

#EXT-X-KEY:METHOD=AES-128,URI="https://dummy-key-url.com/key.bin",IV=0x1f2e3d4c5b6a7988776655443322110

#EXTINF:10.0,
https://your-cdn.b-cdn.net/videos/video_123/stream_english/segment_000.ts
#EXTINF:10.0,
https://your-cdn.b-cdn.net/videos/video_123/stream_english/segment_001.ts
#EXTINF:10.0,
https://your-cdn.b-cdn.net/videos/video_123/stream_english/segment_002.ts
#EXT-X-ENDLIST
```

**Note:** The key URI is a dummy - we'll provide the real key in the player.

---

## 7. BunnyCDN Configuration

### Pull Zone Setup
```
Origin: Wasabi bucket (s3.wasabisys.com/your-bucket)
CDN URL: https://your-cdn.b-cdn.net
Cache TTL: 1 year (segments never change)
```

### Wasabi Bucket Policy (Allow BunnyCDN)
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::your-bucket/videos/*"
  }]
}
```

**Or use Bunny's S3 API directly** (recommended for better integration)

---

## 8. Video Player Implementation (Hardcoded Key)

### HTML5 + HLS.js Example

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
  <video id="video" controls width="800"></video>

  <script>
    const video = document.getElementById('video');
    const videoId = 'video_123';

    // HARDCODED ENCRYPTION KEY (same for all videos)
    const ENCRYPTION_KEY = '3a7f9c2e1d4b8a6f5e3c9d7a2b4e6f8a';

    // Hex string to Uint8Array
    function hexToBytes(hex) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return bytes;
    }

    const keyBytes = hexToBytes(ENCRYPTION_KEY);

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: function(xhr, url) {
          // Intercept key requests
          if (url.includes('key.bin') || url.includes('dummy')) {
            xhr.onload = function() {
              // Override response with our hardcoded key
              Object.defineProperty(xhr, 'response', {
                get: () => keyBytes.buffer
              });
            };
          }
        }
      });

      // Load master playlist from YOUR server (not CDN)
      hls.loadSource(`https://api.yourserver.com/api/video/${videoId}/master.m3u8`);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        video.play();
      });
    }
    // Safari native HLS support
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = `https://api.yourserver.com/api/video/${videoId}/master.m3u8`;
    }
  </script>
</body>
</html>
```

### Alternative: Video.js with videojs-contrib-hls

```html
<link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet" />
<script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/videojs-contrib-hls@latest"></script>

<video id="video" class="video-js vjs-default-skin" controls width="800">
  <source src="https://api.yourserver.com/api/video/video_123/master.m3u8" type="application/x-mpegURL">
</video>

<script>
  const ENCRYPTION_KEY = hexToBytes('3a7f9c2e1d4b8a6f5e3c9d7a2b4e6f8a');

  const player = videojs('video', {
    html5: {
      vhs: {
        xhr: {
          beforeRequest: function(options) {
            if (options.uri.includes('key.bin')) {
              // Provide hardcoded key
              options.onload = function() {
                this.response = ENCRYPTION_KEY.buffer;
              };
            }
            return options;
          }
        }
      }
    }
  });
</script>
```

---

## 9. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  1. TRANSCODE (Your Server/Local)                           │
│     MP4 → ffmpeg → Encrypted HLS segments + playlists       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. UPLOAD TO WASABI                                        │
│     - segment_*.ts (encrypted)                              │
│     - subtitle.vtt files                                    │
│     - NO m3u8 files                                         │
│     - NO encryption keys                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. CONFIGURE BUNNYCDN                                      │
│     Pull Zone → Wasabi bucket → Edge caching enabled        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. USER REQUESTS VIDEO                                     │
│     Browser → Your API → Returns m3u8 (with Bunny URLs)     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. PLAYBACK                                                │
│     Player downloads segments from BunnyCDN → Decrypts      │
│     using hardcoded key → Plays video smoothly              │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Security Considerations

### ⚠️ Hardcoded Key Approach

**Pros:**
- ✅ Zero latency (no key server requests)
- ✅ Works offline after initial load
- ✅ Simple implementation
- ✅ Prevents Wasabi breach exposure

**Cons:**
- ⚠️ Key visible in JavaScript (can be extracted)
- ⚠️ Same key for all videos (if one leaks, all vulnerable)
- ⚠️ Cannot revoke access per-video

**This protects against:**
- ✅ Wasabi storage breach
- ✅ Direct file downloads
- ✅ Content hash matching
- ✅ Casual pirates

**This does NOT protect against:**
- ❌ Determined pirates who inspect JS
- ❌ Screen recording
- ❌ Key extraction from player

### Better Alternatives (If Needed Later)

1. **Obfuscate key in JS** (security through obscurity)
2. **Different key per video** (limits damage if leaked)
3. **Dynamic key delivery** (trade-off: adds latency)
4. **DRM systems** (Widevine/FairPlay - most secure)

---

## 11. Cost Estimation

### Example: 1000 videos, 1 hour each, 10,000 views/month

**Wasabi:**
- Storage: 1000 videos × 2GB = 2TB × $6/TB = **$12/month**
- Egress to BunnyCDN: First 1TB free, then $4/TB

**BunnyCDN:**
- Bandwidth: 10,000 views × 2GB = 20TB × $0.01-0.05/GB = **$200-1000/month**
- (Varies by region)

**Your Server:**
- M3U8 generation: Minimal CPU/bandwidth
- Database queries: Negligible

**Total: ~$210-1000/month** (scales with views, not storage)

---

## 12. Quick Start Checklist

- [ ] Generate encryption key and IV
- [ ] Transcode MP4 to encrypted HLS with ffmpeg
- [ ] Upload segments (not m3u8) to Wasabi
- [ ] Configure BunnyCDN pull zone to Wasabi
- [ ] Create API endpoint to generate m3u8 dynamically
- [ ] Store video metadata + keys in database
- [ ] Implement video player with hardcoded key
- [ ] Test multi-audio and subtitle switching
- [ ] Monitor BunnyCDN cache hit rate

---

## 13. Maintenance & Scaling

### Adding New Videos
```bash
# 1. Transcode
ffmpeg -i new_video.mp4 [encryption params] ...

# 2. Upload to Wasabi
aws s3 cp video_456/ s3://bucket/videos/video_456/ --recursive

# 3. Add to database
INSERT INTO videos VALUES ('video_456', ...)

# 4. Done! Player automatically works
```

### Monitoring
- BunnyCDN analytics (bandwidth, cache hits)
- Wasabi storage usage
- Your API response times for m3u8 generation

---

## Notes

- Subtitles (VTT) are NOT encrypted (standard practice)
- Segment size (10s) balances quality and startup time
- Same key for all videos = simpler but less secure
- M3U8 playlists generated dynamically = flexibility
- No keys stored on Wasabi = safe from breach

**This strategy provides 80% of Netflix security with 20% of the complexity.**
