# Monyvi Project

A friction-less mobile money tracker for the Egyptian market.

## Current Status

**Phase 1: API Server** ✅ (In Progress)

- Express.js API for metals.dev caching
- Supabase integration for rate storage
- Mock API for development

**Phase 2: Mobile App** 🔜 (Coming Next)

- React Native with Expo
- WatermelonDB for offline storage
- Voice input & notification parsing

## Project Structure

```
/monyvi
  /apps/mobile - Expo App
  /packages
    /logic - Parsers and utilities (ready)
    /db - WatermelonDB schema (ready)
    /ui - Design system (ready)
```

## Prerequisites

- **Node.js 20+** and npm
- **Supabase CLI** (installed globally — required for `db:*` and `fn:deploy:*`
  scripts). We install it globally rather than via npm to avoid a flaky ~90MB
  postinstall binary download that has stalled CI for hours.
  - **macOS**: `brew install supabase/tap/supabase`
  - **Windows (scoop)**:
    `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`
  - **Windows (manual)**: download
    [supabase_windows_amd64.zip](https://github.com/supabase/cli/releases/latest),
    extract `supabase.exe` to a folder, and add that folder to your user `PATH`.
  - **Linux**: see
    [Supabase CLI install docs](https://supabase.com/docs/guides/local-development/cli/getting-started).

  Verify with `supabase --version`.

## Quick Start

```bash
# Install dependencies
npm install

# Run API server (port 3001)
npm run dev

# Build for production
npm run build
npm start
```

## Tech Stack (Current)

- **Database**: Supabase (PostgreSQL)
- **Dev Tools**: tsx (hot reload), TypeScript 5.4

## Tech Stack (Future - Mobile)

- **Mobile**: React Native (Expo)
- **Local DB**: WatermelonDB
- **Styling**: NativeWind
- **Voice**: @react-native-voice/voice

## Shared Packages (Ready for Mobile)

### @monyvi/logic

- Voice parser (Egyptian Arabic + English)
- Notification parser (InstaPay, debit cards)
- Category detection
- Currency conversion

### @monyvi/db

- WatermelonDB schema
- Account & Transaction models

### @monyvi/ui

- Egyptian color palette:
  - Nile Green #065F46
  - Monyvi Mint #10B981
  - Expense Red #EF4444
  - Pharaonic Gold #D97706

## License

Proprietary - All rights reserved
