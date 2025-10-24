# StreamCorn - Netflix-like Streaming Service

A modern streaming service built with Next.js, React, Tailwind CSS, shadcn/ui, and Supabase.

## Features Implemented

### Phase 1: Authentication & Profiles

1. **Mobile OTP Authentication** (`/auth`)
   - Phone number input with +91 country code
   - OTP verification via SMS
   - Supabase Auth integration
   - Clean, Netflix-inspired UI

2. **Profile Management** (`/profiles`)
   - Create up to 5 profiles per account
   - Kids profile support
   - Color-coded avatars with initials
   - Edit mode for deleting profiles
   - Profile selection for personalized experience

3. **Home Page** (`/`)
   - Basic layout with navbar
   - Profile switching functionality
   - Ready for content integration

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase
  - Authentication (Phone OTP)
  - PostgreSQL Database
  - Row Level Security (RLS)

## Database Schema

The following tables are configured in Supabase:

- `profiles`: User profiles with avatar, name, kids mode
- `watch_history`: Track viewing progress
- `watched_content`: Completed content
- `watchlist`: Saved content for later
- `continue_watching`: Resume watching functionality

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - The Supabase credentials are already configured

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3003](http://localhost:3003) in your browser

## Project Structure

```
streamcorn/
├── app/
│   ├── auth/          # Authentication page
│   ├── profiles/      # Profile selection/management
│   ├── layout.tsx     # Root layout
│   ├── page.tsx       # Home page
│   └── globals.css    # Global styles
├── components/
│   └── ui/            # shadcn/ui components
├── lib/
│   ├── utils.ts       # Utility functions
│   └── supabase/      # Supabase client configuration
└── middleware.ts      # Auth middleware

```

## User Flow

1. User visits the app → Redirected to `/auth`
2. User enters phone number → Receives OTP
3. User verifies OTP → Redirected to `/profiles`
4. User selects or creates profile → Redirected to `/` (home)
5. User can switch profiles or browse content

## Next Steps

The following features are planned for the next phase:

- Content browsing with TMDB API integration
- Video player functionality
- Continue watching row
- My List / Watchlist
- Search functionality
- Content details page
- Recommendations

## Important Notes

- **Phone Authentication**: Make sure phone authentication is enabled in Supabase dashboard
- **OTP Configuration**: Configure your Supabase project with a valid SMS provider (Twilio, MessageBird, etc.)
- **RLS Policies**: Row Level Security is enabled on all tables for data protection

## Development

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

Required environment variables (already configured in `.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
