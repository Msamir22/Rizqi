# Quickstart: Budget Management

## Prerequisites

- Node.js 18+
- npm workspaces configured (run `npm install` from repo root)
- Supabase project linked

## Setup Steps

### 1. Apply Schema Migration

```bash
# From repo root
npm run db:push        # Apply SQL migration to Supabase
npm run db:migrate     # Regenerate WatermelonDB schema + types
```

### 2. Verify Types

```bash
npx tsc --noEmit
```

### 3. Run Dev Server

```bash
npm run start:android   # or start:ios
```

### 4. Run Tests

```bash
# Logic layer tests
cd packages/logic && npx jest src/budget/__tests__/ --coverage

# Service layer tests
cd apps/mobile && npx jest __tests__/services/budget-service.test.ts
cd apps/mobile && npx jest __tests__/services/budget-alert-service.test.ts
```

## Feature Entry Points

- **Budgets tab**: `apps/mobile/app/(tabs)/budgets.tsx`
- **Budget detail**: `apps/mobile/app/budget-detail.tsx`
- **Create/Edit form**: `apps/mobile/app/create-budget.tsx`
- **Budget service**: `apps/mobile/services/budget-service.ts`
- **Budget logic**: `packages/logic/src/budget/`
