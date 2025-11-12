# StreamCorn - Streaming Application

User-facing streaming application for StreamCorn.

## Features
- Homepage with content browsing
- Search functionality
- Video player
- User authentication
- Profile management
- Subscription management

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Make sure `.env.local` is configured with:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_key
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build for Production

```bash
npm run build
npm start
```

## Port

This app runs on **port 3000** by default.
