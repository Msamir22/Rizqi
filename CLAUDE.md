# Rizqi - Project Instructions

## Project Context

Rizqi is a personal financial app — a frictionless financial companion that
tracks cash, digital payments, and savings (Gold/USD) for the modern Egyptian
user. It solves the "boring manual entry" problem using voice and automation.

The developer (Mohamed) is a Senior Front-end engineer with 8 years of Angular
expertise, new to React/React Native/Expo. When explaining concepts, compare
with Angular equivalents in chat (never in code comments).

## Architecture & Design Principles

- Act as a world-class software architect. Engineer solutions, don't just write
  code.
- The **constitution** (`.specify/memory/constitution.md`) is the highest
  authority. It supersedes all ad-hoc decisions.
- **Offline-first**: WatermelonDB is the single source of truth for all
  user-facing data. Every read/write MUST happen locally first. Cloud sync to
  Supabase is non-blocking background work. The app MUST work with zero network
  connectivity.
- All syncable tables MUST include `created_at`, `updated_at`, `deleted`, and
  `user_id` columns. **Exception**: server-generated read-only pull-only tables
  (e.g., `market_rates`, `daily_snapshot_*`) MAY omit `updated_at` and
  `deleted`.
- Follow SOLID principles strictly. Flag violations immediately.
- Prioritize composition over inheritance, use dependency injection.
- Use appropriate GoF design patterns (Strategy, Factory, Observer, Repository,
  Adapter).
- Encapsulate data access behind Repository pattern with standard operations.
- Use consistent API response envelope: success indicator, data payload, error
  message, pagination metadata.
- No "quick and dirty" fixes unless explicitly asked. No magic numbers or
  hardcoded strings.
- Mark tech debt with `// TODO:` comments.
- Reference `docs/business/business-decisions.md` before implementing any
  business logic. No assumptions — ask if a rule is ambiguous or missing.

## Monorepo Package Boundaries

Dependency direction: `apps/ → packages/logic → packages/db`. **Never reverse.**

- **`packages/db` (`@rizqi/db`)**: WatermelonDB models, schema, types, sync
  config. MUST NOT import from `apps/` or other packages.
- **`packages/logic` (`@rizqi/logic`)**: Shared calculations and parsers (net
  worth, voice parser, currency utils). May import from `@rizqi/db` for types
  only. MUST NOT import from `apps/`.
- **`apps/mobile`**: React Native Expo app. May import from any package.
- **`apps/api`**: Express.js backend. May import from `@rizqi/logic` for shared
  logic.

## Service-Layer Separation

- **`packages/logic/`**: Shared calculations used by both mobile and API. MUST
  NOT import from `apps/`.
- **`apps/mobile/services/`**: Mobile-specific service functions that interact
  with WatermelonDB (e.g., `transaction-service.ts`). Plain async functions, NOT
  hooks.
- **Hooks (`apps/mobile/hooks/`)**: Lifecycle and subscriptions ONLY — observing
  data, managing local UI state, triggering re-renders. MUST NOT contain
  database write logic or business calculations.
- **Components**: Zero business logic. Receive data via props or hooks and
  render UI. `Alert.alert()` and UI concerns stay in calling component/hook,
  never in services.

## TypeScript & React Native

- Write concise, technical TypeScript with strict mode. Prefer interfaces over
  types. Avoid enums — use maps.
- Use functional components with hooks. No class components.
- Use `function Component(props: Props)` for better type inference. Use
  `React.FC<Props>` only when you need `children`.
- Narrow `unknown` in catch blocks (`if (error instanceof Error)`). Never use
  `any`.
- All functions MUST have explicit return type annotations.
- Use `import type` for type-only imports to reduce transpilation overhead.
- Never use `console.log` in production code — use a structured logger.
- Use descriptive names with auxiliary verbs: `isLoading`, `hasError`,
  `isFetchingData`.
- Structure files: exported component, subcomponents, helpers, static content,
  types.
- Use lowercase-hyphenated directories (`components/auth-wizard`). Favor named
  exports.
- Avoid logic in JSX — move business logic to `packages/logic` (if shared) or
  the appropriate mobile folder.
- Use `FlatList` (not manual `.map()`) for long lists with `keyExtractor`. Use
  `useMemo`/`useCallback` for perf-critical components.
- Clean up side effects in `useEffect` return function.
- Use `react-native-safe-area-context`, `KeyboardAvoidingView`, and
  `SafeAreaProvider` for safe areas. No hardcoded safe area padding.
  `SafeAreaProvider` at the root MUST pass `initialMetrics={initialWindowMetrics}`
  so the very first render has the correct top inset (otherwise `expo-router` /
  `react-native-screens` shadow the context and `useSafeAreaInsets()` returns
  `top: 0` on render 1, causing cold-start scroll-jump). Apply the inset exactly
  once per screen — do not nest a `SafeAreaView` inside a subtree that already
  sits under a parent that applied `paddingTop`.
- Use `react-navigation` and `expo-router` for file-based routing.
- Use Zod for runtime validation. Derive types with `z.infer<typeof schema>` —
  don't duplicate type definitions.
- Use Expo managed workflow, EAS Build, and `expo-updates` for OTA updates.
- **i18n**: In functional components, use the `useTranslation` hook
  (`const { t } = useTranslation("namespace")`). In class components or
  non-component files, use the named import `import { t } from "i18next"` —
  never `i18next.t()`.

## Styling Rules

- **NativeWind classes only**: Use `className` for ALL styling. Do NOT use
  `StyleSheet.create()` or inline `style` unless there is no NativeWind
  equivalent (e.g., dynamic computed values like `` width: `${percent}%` ``).
- **Colors via Tailwind config**: All palette colors are registered in
  `tailwind.config.js`. Use NativeWind classes (`bg-slate-800`,
  `text-nileGreen-500`, `border-slate-300`) — never use inline
  `style={{ color: palette.xxx }}` when a class exists. Use `palette` imports
  only for component props that don't accept `className` (e.g.,
  `<Icon color={palette.nileGreen[500]} />`).
- **Opacity modifier**: Use the `/opacity` syntax for semi-transparent colors
  (e.g., `bg-nileGreen-500/20`, `border-slate-300/25`). This works on `View` and
  `Text`. See the NativeWind v4 crash exception below for
  `TouchableOpacity`/`Pressable`.
- **Dark mode**: Use `dark:` variant. NEVER use `isDark` ternary conditionals if
  a Tailwind class works. **Exception**: `isDark` MAY be used for component
  props that accept color values (e.g.,
  `<Switch trackColor={{ false: isDark ? ... : ... }} />`) since `className`
  doesn't work on those props.
- **Theme text colors**: Use `text-text-primary`, `text-text-secondary`,
  `text-text-muted` classes (defined in `tailwind.config.js`) instead of
  `style={{ color: theme.text.primary }}`.
- `palette.slate[25]` is the standard light-mode white for backgrounds/text.
- **NativeWind v4 crash**: `shadow-*`, `opacity-*`, and `bg-color/opacity`
  classes on `TouchableOpacity`/`Pressable` cause a crash. Use inline `style`
  for these specific cases on these specific components only.
- **Reusable class compounds**: When the same combination of classes repeats
  across multiple components, extract it to `global.css` using `@apply` (e.g.,
  `.subtitle-text`, `.body-small`, `.caption-text`).
- Use unified `PageHeader` component for all screen headers (manages drawer
  state internally).
- Use `TextField` for text inputs, `Dropdown` for selections, `OptionalSection`
  for expandable optional fields.

## Database Migrations

All schema changes MUST go through local SQL migration files in
`supabase/migrations/`, never through Supabase MCP or dashboard directly.

- Workflow: Write SQL migration → `npm run db:migrate` → commit both migration
  and generated schema.
- Naming: `supabase/migrations/023_descriptive_name.sql`
- When bringing existing Supabase tables into WatermelonDB: manually add
  `createTable` to `packages/db/src/migrations.ts` and bump schema version
  (auto-gen can't detect this).
- WatermelonDB has no `dropColumn` — removed columns stay in local SQLite but
  are ignored.

## Coding Style

- Immutability: ALWAYS create new objects, NEVER mutate existing ones.
- Many small files > few large files. 200-400 lines typical, 800 max. Functions
  < 50 lines.
- Handle errors explicitly at every level. Never silently swallow errors.
- Validate at system boundaries (user input, external APIs). Fail fast with
  clear messages.

## Git Workflow

Commit format: `<type>: <description>` — Types: feat, fix, refactor, docs, test,
chore, perf, ci.

## Security

- No hardcoded secrets. Use environment variables or secret manager.
- Validate all user inputs. Parameterized queries for SQL. Sanitize HTML for
  XSS.
- CSRF protection, rate limiting on endpoints. Error messages don't leak
  sensitive data.

## Testing

- TDD mandatory: Write test first (RED) → Run (FAIL) → Implement (GREEN) →
  Refactor → Verify coverage (80%+).
- Unit tests (Jest + React Native Testing Library), integration tests, E2E tests
  (Detox/Maestro).
- Fix implementation, not tests (unless tests are wrong).

## Auto-Detect Rules

During conversations, if you notice instructions/guidelines specific to this
project not covered in CLAUDE.md, suggest adding them. Example: if told to move
mapping logic from component to model, suggest a rule update with location.

## Prohibited Patterns

- Static colors (`#FFFFFF`, `rgb(0,0,0)`)
- `isDark` ternary logic for background/text colors
- `StyleSheet.create()` or inline `style` when a NativeWind class exists
- `style={{ color: palette.xxx }}` on `Text`/`View` when a Tailwind class exists
  (e.g., use `text-nileGreen-500` not
  `style={{ color: palette.nileGreen[500] }}`)
- Custom header implementations (use `PageHeader`)
- `withObservables` HOC for simple data fetching (use hooks like `useAccounts`)
- NativeWind `shadow-*`, `opacity-*`, `bg-color/opacity` on
  `TouchableOpacity`/`Pressable`
- `i18next.t()` — use `{ t } from "i18next"` or `useTranslation` hook instead
