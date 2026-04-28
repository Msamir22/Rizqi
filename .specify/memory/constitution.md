<!--
Sync Impact Report
- Version change: 0.0.0 → 1.0.0 → 1.1.0 → 1.2.0
- Added principles:
  - I. Offline-First Data Architecture (NEW in 1.0.0, AMENDED in 1.2.0)
  - II. Documented Business Logic (NEW in 1.0.0)
  - III. Type Safety (NEW in 1.0.0)
  - IV. Service-Layer Separation (NEW in 1.0.0)
  - V. Premium UI with Consistent Theming (NEW in 1.0.0, AMENDED in 1.1.0)
  - VI. Monorepo Package Boundaries (NEW in 1.0.0)
  - VII. Local-First Migrations (NEW in 1.0.0)
- Amendments in 1.1.0:
  - Principle V: Added schema-driven UI rule (from mockup-implementation workflow)
  - Development Workflow: Added no-magic-numbers and TODO-for-debt rules (from architect-first.md)
- Amendments in 1.2.0:
  - Principle I: Added exception for server-generated read-only tables (pull-only)
    that MAY omit updated_at and deleted columns (from 005-sync-snapshot-tables)
- Added sections:
  - Technology Constraints (NEW)
  - Development Workflow (NEW)
  - Governance (NEW)
- Templates requiring updates:
  - plan-template.md ✅ — Constitution Check section aligns with principles
  - spec-template.md ✅ — User Scenarios and Requirements sections compatible
  - tasks-template.md ✅ — Phase structure and path conventions compatible
- Follow-up TODOs:
  - TODO(BUSINESS_DECISIONS_AUDIT): business-decisions.md needs a full audit
    to reconcile outdated entries with current implementation decisions
-->

# Rizqi Constitution

## Core Principles

### I. Offline-First Data Architecture

WatermelonDB is the **single source of truth** for all user-facing data on the
device. Every read and write operation MUST happen locally first.

- All user data (accounts, transactions, transfers, categories, debts, recurring
  payments, assets) MUST be persisted in WatermelonDB before any network call.
- Cloud sync to Supabase runs in the background and MUST be non-blocking. The
  app MUST remain fully functional with zero network connectivity.
- Local calculations (net worth, account balances, asset valuations) MUST NOT
  depend on API availability. Use `@rizqi/logic` for on-device computation.
- Sync uses **Last Write Wins** conflict resolution via WatermelonDB's built-in
  sync protocol.
- All syncable tables MUST include `created_at`, `updated_at`, `deleted`, and
  `user_id` columns. **Exception**: Server-generated read-only tables that are
  pull-only (never edited or soft-deleted client-side) MAY omit `updated_at` and
  `deleted`. These tables use a custom pull function with date-based filtering
  instead of the standard sync protocol. Current examples: `market_rates` (also
  omits `user_id`), `daily_snapshot_balance`, `daily_snapshot_assets`,
  `daily_snapshot_net_worth`.

### II. Documented Business Logic

All finalized business rules MUST be documented in
`docs/business/business-decisions.md` before implementation begins and kept up
to date as decisions evolve.

- Agents and developers MUST reference `business-decisions.md` for any business
  rule before writing code. If the document contradicts the current codebase,
  the **codebase is authoritative** — update the document to match.
- No assumptions about business logic are permitted. When a rule is ambiguous or
  missing from the document, ask the project owner for clarification.
- New business decisions MUST be added to the document as they are made.
- Outdated entries MUST be corrected or removed when discovered.
- Schema changes MUST be reflected in the document's table definitions.

### III. Type Safety (NON-NEGOTIABLE)

TypeScript strict mode is enforced across the entire monorepo. There are no
exceptions.

- **Never use `any`**. Use proper types, generics, or `unknown` when the type is
  truly unknown.
- All functions and methods MUST have explicit return type annotations.
- Use `interface` for object shapes; use `type` only for unions, intersections,
  or mapped types.
- Use `import type` for type-only imports to reduce transpilation overhead.
- Prefer `readonly` for properties that MUST NOT change after initialization.
- Validate all external API responses at runtime using `zod` schemas.
- Handle `null` and `undefined` safely — never use non-null assertions (`!`).
- Use `const` by default; `let` only when reassignment is necessary.
- Prefer `async/await` over `.then()` chains.

### IV. Service-Layer Separation

Business logic MUST be separated from UI and React lifecycle concerns.

- **`packages/logic/`**: Shared calculations and parsers used by both mobile and
  API (e.g., net worth calculations, voice parser, currency utils). Packages
  MUST NOT import from `apps/`.
- **`apps/mobile/services/`**: Mobile-specific service functions that interact
  with WatermelonDB (e.g., `transaction-service.ts`, `account-service.ts`).
  These are plain async functions, not hooks.
- **Hooks (`apps/mobile/hooks/`)**: React hooks handle **lifecycle and
  subscriptions only** — observing data, managing local UI state, triggering
  re-renders. Hooks MUST NOT contain database write logic or business
  calculations.
- **Components**: Zero business logic. Components receive data via props or
  hooks and render UI. Move all calculations to the service or logic layer.
- The `Alert.alert()` pattern and all UI-specific concerns MUST stay in the
  calling component or hook, never in the service layer.

### V. Premium UI with Consistent Theming

The app MUST deliver a premium, polished visual experience using NativeWind
(Tailwind CSS for React Native) as the primary styling mechanism.

- **Prefer Tailwind CSS classes** (`className="..."`) over `StyleSheet.create`
  unless absolutely necessary for dynamic values or complex calculations.
- **Dark mode**: Use Tailwind dark variants (`dark:bg-background-dark`) for
  styling. The `isDark` ternary conditional MUST NOT be used in style objects or
  `className` props. **Exception**: `isDark` MAY be used for component props
  that accept color values (e.g., `<Icon color={isDark ? '#fff' : '#000'} />`),
  because Tailwind `className` does not work with these props.
- **Known NativeWind v4 bug**: `shadow-*`, `opacity-*`, and `bg-color/opacity`
  Tailwind classes on `TouchableOpacity` or `Pressable` cause a race condition
  crash. Use inline `style` props for shadow/elevation on these components.
- **Color palette**: Use the Egyptian-inspired palette defined in
  `apps/mobile/constants/colors.ts`. Never hardcode hex values in JSX.
- **Animations**: Use `react-native-reanimated` and
  `react-native-gesture-handler` for smooth micro-interactions.
- **No basic MVPs**: Every screen MUST feel premium — vibrant gradients, subtle
  animations, modern typography, and intentional spacing.
- **Schema-driven UI**: All data-driven screens MUST strictly match the existing
  database schema (`@rizqi/db` models). Do NOT invent, rename, remove, or infer
  fields. Labels, data types, and required/optional states MUST reflect the
  schema exactly.

### VI. Monorepo Package Boundaries

The Rizqi monorepo uses npm workspaces + Nx with strict dependency direction.

- **`packages/db` (`@rizqi/db`)**: WatermelonDB models, schema definitions, type
  exports, and sync configuration. MUST NOT import from `apps/` or other
  packages.
- **`packages/logic` (`@rizqi/logic`)**: Shared business logic (asset
  calculations, voice parser, notification parser, currency utils). May import
  from `@rizqi/db` for types only. MUST NOT import from `apps/`.
- **`apps/mobile`**: The React Native Expo app. May import from any package.

- Dependency direction: `apps/ → packages/logic → packages/db`. Never reverse.
- Prefer named exports over default exports for better refactoring tooling.
- Each package MUST have its own `tsconfig.json` extending the root config.

### VII. Local-First Migrations

All database schema changes (DDL) MUST go through local SQL migration files.

- Create `.sql` migration files in `supabase/migrations/` for every schema
  change (tables, columns, triggers, functions, indexes, RLS policies, enums).
- Follow the existing numbering convention:
  `supabase/migrations/NNN_descriptive_name.sql`.
- Run `npm run db:push` to apply local migrations to the remote Supabase
  database.
- Run `npm run db:migrate` to regenerate WatermelonDB schema, types, and local
  watermelon migrations from the latest SQL migration.
- Run `npm run db:sync-local` when you need to ensure that `schema.ts` and
  `supabase-types.ts` are up-to-date without pushing to remote. This also picks
  up the latest local migration into the WatermelonDB schema. Use this instead
  of `db:migrate` when the remote database is already up-to-date and you only
  need to refresh local generated files.
- **NEVER** use the Supabase MCP tool's `apply_migration` or `execute_sql` for
  DDL changes. **NEVER** make schema changes directly in the Supabase dashboard.
- The Supabase MCP tool MAY be used for **read-only** operations (querying data,
  checking schema, listing tables, inspecting logs).
- Commit both the migration file and generated schema changes together.
- **Bringing existing Supabase tables into WatermelonDB:** When adding an
  existing Supabase table to WatermelonDB sync (removing it from
  `EXCLUDED_TABLES` in both `transform-schema.js` and
  `sql-to-watermelon-migration.js`), you MUST manually add a `createTable` step
  to `packages/db/src/migrations.ts` and bump the schema version. The
  auto-generation script cannot detect this because no `CREATE TABLE` exists in
  the latest SQL migration.
- **DROP COLUMN:** WatermelonDB has no `dropColumn` migration primitive. Dropped
  columns remain in local SQLite but are ignored. No WatermelonDB migration is
  needed for column drops.

## Technology Constraints

| Concern              | Technology                                | Notes                                       |
| -------------------- | ----------------------------------------- | ------------------------------------------- |
| Mobile Framework     | React Native + Expo (managed workflow)    | File-based routing via Expo Router          |
| Styling              | NativeWind v4 (Tailwind CSS for RN)       | Known shadow bug on interactive components  |
| Local Database       | WatermelonDB (SQLite-based)               | Offline-first, sync-aware                   |
| Cloud Database       | Supabase (PostgreSQL + Auth + RLS)        | Anonymous auth for guest mode               |
| Backend API          | Express.js on Vercel                      | Market rates and external data only         |
| Monorepo             | npm workspaces + Nx                       | Build caching and task orchestration        |
| Language             | TypeScript (strict mode)                  | Across all packages and apps                |
| Animations           | React Native Reanimated + Gesture Handler | Required for premium interactions           |
| API Caching          | React Query (TanStack Query)              | Prevents duplicate API calls                |
| Target Market        | Egyptian users                            | EGP primary currency, Arabic support future |
| Supported Currencies | EGP, USD, EUR + 34 others                 | One account = one currency                  |
| Precious Metals      | Gold, Silver, Platinum, Palladium         | Unified `purity_fraction` valuation         |

## Development Workflow

### Code Quality Gates

- **Always clarify before coding**. No assumptions about requirements, business
  rules, or user intent. Ask clarifying questions when information is
  incomplete.
- **SOLID principles** enforced. Composition over inheritance. Dependency
  injection for decoupling.
- **Single Responsibility**: Each file, function, and component has one clear
  purpose. Extract when responsibilities overlap.
- **Performance awareness**: Memoize with `useMemo` and `useCallback` in
  performance-critical components. Use `FlatList` for lists, never manual
  `.map()` for long arrays. Batch database operations to avoid N+1 patterns.
- **No magic numbers or hardcoded strings**. Extract constants with descriptive
  names. Never scatter unexplained literals through code.
- **No untracked technical debt**. Do not leave shortcuts or known issues
  without a `// TODO:` comment explaining the debt and the intended resolution.

### Naming Conventions

| Target      | Convention                 | Example                 |
| ----------- | -------------------------- | ----------------------- |
| Components  | PascalCase                 | `TransactionCard`       |
| Functions   | camelCase                  | `calculateNetWorth`     |
| Variables   | camelCase + descriptive    | `isLoading`, `hasError` |
| Directories | lowercase-hyphenated       | `transaction-card/`     |
| Interfaces  | PascalCase (no `I` prefix) | `TransactionProps`      |
| Types       | PascalCase                 | `DisplayTransaction`    |
| Constants   | SCREAMING_SNAKE_CASE       | `MAX_RETRY_COUNT`       |
| DB Columns  | snake_case                 | `from_account_id`       |
| DB Tables   | snake_case (plural)        | `recurring_payments`    |

### Pre-Commit Checks

- ESLint with custom rules (no hardcoded hex in JSX, no `isDark` ternary in
  styles) runs via Husky + lint-staged on every commit.
- TypeScript compilation check MUST pass.
- No `console.log` statements in committed code (use structured logging).

### File Organization

- Each component in its own file; keep components small and focused.
- Group by feature: `/components/transactions/`, `/components/dashboard/`.
- Use `index.ts` barrel exports for clean imports.
- Separate interfaces and types into dedicated files when shared across multiple
  components.

## Governance

- This constitution **supersedes** all ad-hoc decisions. When a principle
  conflicts with a one-off instruction, the constitution wins unless formally
  amended.
- **Amendments** require:
  1. Updating this file with the change.
  2. Updating `business-decisions.md` if the change affects business rules.
  3. Updating relevant `.agent/rules/` files if the change affects agent
     behavior.
  4. Bumping the version below according to semver rules.
- **Version bumps**:
  - MAJOR: Principle removed or redefined in a backward-incompatible way.
  - MINOR: New principle or section added, or existing one materially expanded.
  - PATCH: Wording clarifications, typo fixes, non-semantic refinements.
- **Compliance review**: All spec-kit commands (`/speckit.specify`,
  `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`) MUST reference this
  constitution and verify compliance before producing output.

**Version**: 1.2.0 | **Ratified**: 2026-02-14 | **Last Amended**: 2026-02-19
