# Quickstart: 011 SMS Flow Fixes

**Branch**: `011-sms-flow-fixes`

## Prerequisites

- Node.js, npm, Android emulator/device
- Supabase project access (for `db:push`)
- On the `011-sms-flow-fixes` branch

## Setup

```bash
git checkout 011-sms-flow-fixes
npm install
npm run db:push       # Apply migration 030
npm run db:migrate    # Regenerate WatermelonDB schema/types/migrations
```

## Key Files

| File                                                         | Purpose                          |
| ------------------------------------------------------------ | -------------------------------- |
| `supabase/migrations/030_add_sms_body_hash_to_transfers.sql` | DB migration                     |
| `apps/mobile/services/sms-sync-service.ts`                   | Hash normalization + dedup logic |
| `apps/mobile/services/batch-sms-transactions.ts`             | Saves hash on transfers          |
| `apps/mobile/components/sms-sync/AccountSetupStep.tsx`       | Back + Cancel buttons            |
| `apps/mobile/components/sms-sync/SmsScanProgress.tsx`        | Text alignment fix               |

## Testing

1. Run SMS scan → save transactions (including ATM withdrawal as transfer)
2. Rescan → verify zero duplicates appear
3. Navigate to Account Setup → verify back arrow and cancel button work
4. Observe loading state on Account Setup → verify skeleton appears
5. During scanning → verify progress text doesn't overlap pipeline card
