# Supabase Setup Guide for Astik

This guide will walk you through setting up Supabase for the Astik project.

## Prerequisites

- Supabase account (free tier is fine for MVP)
- Existing Supabase project named "Astik" (or create a new one)

## Step 1: Access Your Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Open your "Astik" project (or create a new one)

## Step 2: Get Your Project Credentials

1. In your Supabase dashboard, click **Settings** (gear icon) in the sidebar
2. Go to **API** section
3. Copy the following values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon public** key: `eyJhbGciOiJIUzI1...` (long string)
   - **service_role** key: `eyJhbGciOiJIUzI1...` (different long string - keep
     this SECRET!)

## Step 3: Set Up Environment Variables

1. Navigate to `apps/api/` folder
2. Copy `.env.example` to `.env.local`:

   ```bash
   cp apps/api/.env.example apps/api/.env.local
   ```

3. Edit `apps/api/.env.local` and fill in:

   ```env
   # Supabase
   EXPRESS_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPRESS_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

   # metals.dev API (get free key at https://metals.dev)
   METALS_DEV_API_KEY=your_metals_dev_api_key_here

   # Cron job secret (generate a random string)
   CRON_SECRET=generate_a_random_string_here
   ```

## Step 4: Run Database Migration

### Option A: Using SQL Editor (Recommended)

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire content of `supabase/migrations/001_create_market_rates.sql`
4. Paste into the SQL editor
5. Click **Run** (or press Ctrl/Cmd + Enter)
6. You should see "Success. No rows returned"

### Option B: Using Supabase CLI (Advanced)

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Push migration
supabase db push
```

## Step 5: Verify Setup

1. In Supabase dashboard, go to **Table Editor**
2. You should see `market_rates` table
3. Click on it - you should see 1 row with initial empty data

## Step 6: Test Your API

### Start the API server:

```bash
npm run dev
```

### Test endpoints:

**Mock API (should work immediately):**

```bash
curl http://localhost:3001/api/mock/rates
```

You should see mock metal and currency data.

**Real API (after first update):**

```bash
curl http://localhost:3001/api/rates
```

Initially might return "No rates found" - that's expected.

**Trigger rate update (requires CRON_SECRET):**

```bash
curl -X POST http://localhost:3001/api/rates/update \
  -H "x-cron-secret: your_cron_secret_from_env_file"
```

Should return: `{"success":true,"message":"Rates updated successfully",...}`

After this, `GET /api/rates` should return real data from Supabase.

## Step 7: Set Up Scheduled Updates (Production)

When deploying to Vercel, Railway, or similar:

1. **Vercel** (Recommended):
   - Add `vercel.json` to project root:
     ```json
     {
       "crons": [
         {
           "path": "/api/rates/update",
           "schedule": "*/30 * * * *"
         }
       ]
     }
     ```
   - Set environment variables in Vercel dashboard

2. **Railway**:
   - Use Railway's Cron Jobs feature
   - Configure to call your API every 30 minutes

3. **Manual cron** (VPS):
   - Add to crontab:
     ```
     */30 * * * * curl -X POST https://your-domain.com/api/rates/update -H "x-cron-secret: YOUR_SECRET"
     ```

## Database Schema

### `market_rates` Table

| Column       | Type        | Description                                      |
| ------------ | ----------- | ------------------------------------------------ |
| `id`         | INTEGER     | Always 1 (single row table)                      |
| `metals`     | JSONB       | Metal prices (gold, silver, platinum, palladium) |
| `currencies` | JSONB       | Currency rates (EGP, EUR, GBP, etc.)             |
| `timestamp`  | TIMESTAMPTZ | When rates were fetched from metals.dev          |
| `created_at` | TIMESTAMPTZ | Record creation time                             |
| `updated_at` | TIMESTAMPTZ | Last update time (auto-updated)                  |

### Row Level Security (RLS)

- ✅ **Public read access**: Anyone can read rates (for mobile app)
- ✅ **Service role write**: Only service role can update (for API server)

## Troubleshooting

### "No rates found" error

- Run the update endpoint manually (see Step 6)
- Check that METALS_DEV_API_KEY is valid
- Check Supabase logs in dashboard

### "Unauthorized" error on update

- Verify CRON_SECRET matches in .env.local and request header
- Make sure you're using POST, not GET

### "Supabase error" in logs

- Check RLS policies are correctly set up
- Verify SUPABASE_SERVICE_ROLE_KEY is correct (not anon key)
- Check Supabase dashboard logs for details

## Next Steps

✅ Database is ready! ⬜ Set up mobile app (Expo + React Native) ⬜ Connect
mobile app to API ⬜ Test end-to-end flow

---

**Need help?** Check Supabase logs in the dashboard under **Logs** section.
