# Quickstart: Voice Transaction Infrastructure Refinements

## Prerequisites

- Node.js 18+ and npm
- Android device/emulator with Expo dev client
- Supabase CLI (`npx supabase`)
- Access to Supabase Edge Functions deployment

## Getting Started

### 1. Create Feature Branch

```bash
git checkout -b 021-voice-transaction-refinements
```

### 2. Phase 1 — Shared Utils + Types (Foundation)

```bash
# Create shared utils file
# Location: packages/logic/src/utils/ai-parser-utils.ts
# Create test file
# Location: packages/logic/src/utils/__tests__/ai-parser-utils.test.ts

# Run tests
cd packages/logic && npx jest --testPathPattern="ai-parser-utils" --verbose

# Verify types
npm run typecheck
```

### 3. Phase 2 — Edge Function

```bash
# Update: supabase/functions/parse-voice/index.ts
# Add original_transcript + detected_language to schema

# Deploy
npx supabase functions deploy parse-voice --project-ref <YOUR_PROJECT_REF>

# Test with text query
curl -X POST https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/parse-voice \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"query": "I spent 50 on coffee", "callerLocalDate": "<YYYY-MM-DD>"}'
```

### 4. Phase 3 — Parser + Review Refactors

```bash
# Modify: apps/mobile/services/ai-voice-parser-service.ts
# Modify: apps/mobile/services/ai-sms-parser-service.ts
# Modify: apps/mobile/components/transaction-review/*.tsx
# Modify: apps/mobile/app/voice-review.tsx

# Full typecheck
npm run typecheck
```

### 5. Phase 4 — UI/UX Fixes

```bash
# Modify overlay, tab bar, FAB components
# Test on device

npm run mobile:android  # or your dev command
```

## Key Files

| File                                              | Purpose                                           |
| ------------------------------------------------- | ------------------------------------------------- |
| `packages/logic/src/utils/ai-parser-utils.ts`     | Shared pure functions                             |
| `packages/logic/src/types.ts`                     | `ReviewableTransaction`, `ParsedVoiceTransaction` |
| `apps/mobile/services/ai-voice-parser-service.ts` | AI voice parser client                            |
| `supabase/functions/parse-voice/index.ts`         | Edge Function                                     |
| `apps/mobile/components/transaction-review/`      | Generic review UI                                 |

## Verification

```bash
# Unit tests
cd packages/logic && npx jest --testPathPattern="ai-parser-utils" --verbose

# Type safety
npm run typecheck

# Manual: Record silence → should show error state
# Manual: Record Arabic → should show "AR" badge
```
