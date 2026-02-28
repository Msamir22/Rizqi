# Quickstart: Refine AI SMS Parsing Accuracy

**Branch**: `010-refine-ai-parsing`

## Prerequisites

- Node.js 18+ and npm installed
- Supabase CLI for Edge Function deployment
- Android device/emulator for manual testing

## Development Setup

```bash
# 1. Ensure you're on the feature branch
git checkout 010-refine-ai-parsing

# 2. Install dependencies (if not already)
npm install

# 3. Start the metro bundler + android
npm run start:android
```

## Key Files to Edit (in order)

1. `supabase/functions/parse-sms/index.ts` — Edge Function (deploy first)
2. `apps/mobile/services/ai-sms-parser-service.ts` — Client service
3. `apps/mobile/components/sms-sync/SmsTransactionItem.tsx` — UI confidence tag

## Deploying Edge Function Changes

```bash
npx supabase functions deploy parse-sms --project-ref <YOUR_PROJECT_REF>
```

## Testing

1. Open the app on Android
2. Navigate to SMS Scan
3. Run a full scan and verify:
   - Confidence tags appear on each transaction card
   - No "cash withdrawal" categories
   - No bank names in counterparty field
   - Account suggestions sourced from bank registry only
