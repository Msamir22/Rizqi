# Monyvi Project

Monyvi is an offline-first personal finance companion for the Egyptian market.
It tracks cash, bank accounts, digital wallets, transactions, budgets, recurring
payments, metal holdings, live gold/silver and currency rates, and inflation
rate guidance, with low-friction entry through voice and SMS.

## Current Status

The active product is the Expo mobile app in `apps/mobile`.

- Expo Router mobile app with mandatory Supabase authentication.
- WatermelonDB local database as the user-facing source of truth.
- Supabase sync, RLS, and Edge Functions.
- Gemini-powered `parse-voice` and `parse-sms` functions.
- metals.dev-backed live rates for gold, silver, and roughly 35 currencies.
- Inflation rate tracking and guidance for contextual money decisions.

## Project Structure

```text
/monyvi
  /apps/mobile - Expo app
  /packages
    /logic - Shared calculations, parsers, and utilities
    /db - WatermelonDB schema, models, migrations, and Supabase types
  /supabase
    /functions - Supabase Edge Functions
    /migrations - Local SQL migrations
  /docs - Business, architecture, design, process, and audit docs
  /specs - Feature specs, plans, contracts, and mockups
```

## Prerequisites

- **Node.js 20+** and npm
- **Supabase CLI** installed globally. It is required for `db:*` and
  `fn:deploy:*` scripts.

Verify Supabase CLI with:

```bash
supabase --version
```

## Quick Start

```bash
# Install dependencies
npm install

# Start Expo dev server
npm run mobile

# Run mobile tests
npm test -w @monyvi/mobile

# Run lint
npm run lint
```

## Local Supabase Mobile App

For normal local development against the local Supabase stack:

```bash
# 1. Start Supabase from the repo root
npx supabase start

# 2. Start the Expo dev client in normal app mode
npm run mobile:local-supabase
```

`mobile:local-supabase` reads the local anon key from
`npx supabase status -o env`, points Android emulators at
`http://10.0.2.2:54321`, and keeps test-only fixture behavior off. Use
`mobile:e2e-fixture` only when you want the deterministic E2E fixture parser and
seeded test flow.

## Tech Stack

- **Mobile:** React Native + Expo
- **Navigation:** Expo Router
- **Local database:** WatermelonDB
- **Cloud:** Supabase Auth, PostgreSQL, RLS, Edge Functions
- **Styling:** NativeWind
- **Voice:** expo-speech-recognition + Gemini Edge Function parsing
- **SMS:** Android SMS reader/listener + Gemini Edge Function parsing
- **Observability:** Sentry
- **Monorepo:** npm workspaces + Nx

## Key Documentation

- [Business decisions](docs/business/business-decisions.md)
- [Technical architecture](docs/architecture/technical-architecture.md)
- [Design system](docs/design/design-system.md)
- [Constitution](.specify/memory/constitution.md)

## Shared Packages

### `@monyvi/logic`

- Currency and amount helpers
- Metal and net-worth calculations
- Budget utilities
- Analytics helpers
- SMS parser/filter/hash utilities
- AI parser mapping utilities

### `@monyvi/db`

- WatermelonDB schema
- WatermelonDB models
- Local migrations
- Generated Supabase types

## License

Proprietary - All rights reserved
