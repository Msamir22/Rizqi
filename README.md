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
- **Docker Desktop** running. Local Supabase runs in Docker containers.
- **Supabase CLI** available through `npx supabase` or installed globally. It is
  required for `db:*`, `supabase:*`, and `fn:deploy:*` scripts.
- **Android Studio + an Android emulator** for Android development.
- A **development build** of the mobile app installed on the emulator/device.
  Expo Go is not enough for SMS/native-permission work.

Verify Supabase CLI with:

```bash
npx supabase --version
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

## Local Development Environment

Use this path when you want the mobile app to run against the local Supabase
database, auth server, Edge Functions, triggers, and cron setup.

```bash
# 1. Install dependencies
npm install

# 2. Start local Supabase
npm run supabase:start:local

# 3. Apply pending local migrations, if any
npx supabase migration up --local

# 4. Configure local runtime-only jobs
npm run supabase:runtime:setup-local

# 5. Optional but recommended: copy global market rates from remote to local
npm run supabase:market-rates:import-local

# 6. Start the mobile app against local Supabase
npm run mobile:local-supabase
```

`mobile:local-supabase` reads the local anon key from
`npx supabase status -o env`, points Android emulators at
`http://10.0.2.2:54321`, and keeps test-only fixture behavior off. Use
`mobile:e2e-fixture` only when you want the deterministic E2E fixture parser and
seeded test flow.

### Verify Local Setup

Check that the Supabase containers are running:

```bash
npx supabase status
```

Check the local API URL and local anon key:

```bash
npx supabase status -o env
```

Check that local market rates have data:

```bash
npx supabase db query --local "select count(*) as count, max(created_at) as newest from public.market_rates;"
```

Check that the local market-rates cron job is scheduled:

```bash
npx supabase db query --local "select jobname, schedule, active from cron.job where jobname = 'fetch-metal-rates';"
```

Check recent local cron runs:

```bash
npx supabase db query --local "select status, return_message, start_time, end_time from cron.job_run_details order by start_time desc limit 5;"
```

### When To Rerun Local Runtime Setup

Run `npm run supabase:runtime:setup-local` after:

- starting from a fresh local Supabase stack
- `npx supabase db reset`
- recreating local containers
- changing local Edge Function or cron setup
- noticing that `fetch-metal-rates` is missing from `cron.job`

You do not need to run it every time you start the mobile app.

### Local Google Sign-In

Local Supabase can use Google sign-in for normal development. Add your local
Google OAuth credentials to the ignored root `.env` file:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-google-client-secret
```

In Google Cloud Console, add this authorized redirect URI for the local Supabase
callback:

```text
http://127.0.0.1:54321/auth/v1/callback
```

Then restart the local stack and run the app with the Google-friendly local
script:

```bash
npm run supabase:start:local
npm run mobile:local-supabase:google
```

`mobile:local-supabase:google` points the emulator at `http://127.0.0.1:54321`
and runs `adb reverse tcp:54321 tcp:54321` so the browser-based OAuth callback
can reach local Supabase. Use `mobile:local-supabase` when you do not need
Google sign-in.

If Google sign-in fails after opening the browser, verify the reverse exists:

```bash
adb reverse --list
```

You should see:

```text
tcp:54321 tcp:54321
```

### Local Supabase Runtime Data

Local migrations create the schema, triggers, functions, and cron extension
setup. They do not copy production data. To copy the global market-rate rows
from the linked remote database into local Supabase:

```bash
npm run supabase:market-rates:import-local
```

To align local runtime jobs with the linked environment, run:

```bash
npm run supabase:runtime:setup-local
```

This schedules the local `fetch-metal-rates` cron job against the local Edge
Function endpoint. Schema-level functions and triggers are kept in migrations.

For local Edge Functions that call external services, add these ignored root
`.env` values before restarting Supabase:

```bash
METALS_DEV_API_KEY=your-metals-dev-key
GEMINI_API_KEY=your-gemini-key
```

After changing local Edge Function secrets, restart the stack:

```bash
npx supabase stop
npm run supabase:start:local
npm run supabase:runtime:setup-local
```

### Common Local Issues

- If Metro starts but npm exits with an error, make sure no old Metro process is
  occupying port `8081`.
- If the app opens Expo Go instead of Monyvi, install or launch the development
  build, not Expo Go.
- If local Google sign-in cannot reach the callback, run
  `adb reverse tcp:54321 tcp:54321` while the emulator is running.
- If `market_rates` is empty, run `npm run supabase:market-rates:import-local`.
- If Edge Functions that call external services fail, check that the required
  ignored root `.env` secrets are set and restart local Supabase.

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
