# Monyvi Design System

**Last updated:** 2026-05-16 **Status:** V1 visual foundation for dashboard,
metals, add holding, and accounts

This document describes the app-wide UI system used by `apps/mobile`. The v1
direction is based on the approved dashboard, metals, add holding, and accounts
mockups: warm paper light mode, deep green-black dark mode, calm financial
hierarchy, glassy elevated cards, and Monyvi green as the primary action color.

## 1. Design Direction

Monyvi should feel like a trusted financial companion for Egyptian users:
premium, calm, fast, and easy to scan. The interface should make balances,
holdings, rates, payments, and account places obvious without making users parse
busy dashboards.

Priorities:

- Clear financial hierarchy: totals first, then trends, actions, and details.
- Low-friction entry: voice, SMS import, quick actions, and compact forms.
- Trust: explicit actions, clear destructive states, and recoverable errors.
- Offline confidence: skeletons and local data should make the app feel usable
  while sync runs in the background.

## 2. Theme Tokens

Primary sources:

- `apps/mobile/constants/colors.ts`
- `apps/mobile/tailwind.config.js`
- `apps/mobile/global.css`
- `apps/mobile/context/ThemeContext.tsx`

### Raw Palettes

`colors.ts` exposes raw palettes for:

- `brandGreen`: v1 brand/action/success green.
- `night`: deep green-black dark surfaces.
- `paper`: warm light backgrounds and surfaces.
- `gold` and `silver`: metals and wealth visuals.
- `danger` and `info`: semantic feedback states.
- `slate`, `nileGreen`, `red`, `blue`, `orange`, and `violet`: compatibility and
  supporting palettes used by existing screens.

Keep existing compatibility palettes until the older screens are migrated. New
v1 work should prefer semantic tokens instead of direct raw palette classes.

### Semantic Themes

`lightTheme` and `darkTheme` define:

- Backgrounds: `background`, `backgroundGradient`
- Surfaces: `surface`, `surfaceRaised`, `surfaceMuted`, `surfaceHighlight`,
  `surfaceGlass`
- Text: `text.primary`, `text.secondary`, `text.muted`, `text.inverse`
- Borders: `border`, `borderSubtle`, `borderStrong`, `borderGlass`
- Status and accents: `action`, `success`, `danger`, `info`, `metal.gold`,
  `metal.silver`
- Loading: `skeleton.base`, `skeleton.highlight`
- Platform chrome: `statusBarStyle`

Runtime theme mode is `light`, `dark`, or `system`, persisted in AsyncStorage by
`ThemeContext`.

### Tailwind Registration

Use NativeWind classes first. The Tailwind config exposes semantic tokens such
as:

- `bg-app dark:bg-app-dark`
- `bg-card dark:bg-card-dark`
- `bg-card-muted dark:bg-card-muted-dark`
- `bg-glass dark:bg-glass-dark`
- `border-border-card dark:border-border-card-dark`
- `border-border-glass dark:border-border-glass-dark`
- `text-text-primary dark:text-text-primary-dark`
- `text-text-secondary dark:text-text-secondary-dark`
- `text-text-muted dark:text-text-muted-dark`
- `bg-action dark:bg-action-dark`
- `text-success dark:text-success-dark`
- `text-danger dark:text-danger-dark`
- `text-metal-gold dark:text-metal-gold-dark`
- `text-metal-silver dark:text-metal-silver-dark`

Use raw palette classes only when a semantic token is too broad for the visual
purpose, such as a specific brand logo, metal illustration, or category color.

## 3. Reusable Components

Use shared primitives before creating local screen-specific variants:

| Component              | Purpose                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `PageHeader`           | Standard header with safe-area handling, drawer/back actions, right actions, and selection mode. |
| `Button`               | Primary, secondary, outline, ghost, danger, and dashed actions.                                  |
| `TextField`            | Labeled text input with error state and controlled draft behavior.                               |
| `Dropdown`             | Inline or bottom-sheet selection control.                                                        |
| `Skeleton`             | Theme-aware shimmer loading primitive.                                                           |
| `AppCard`              | Standard light/dark card surface with semantic border.                                           |
| `GlassCard`            | Translucent elevated card for dashboard/metals/accounts panels.                                  |
| `MetricCard`           | Financial summary card for totals, subtitles, and trends.                                        |
| `InlineNotice`         | Low-noise inline banner for SMS, trusted pricing, and insights.                                  |
| `SegmentedControl`     | Compact filters like All/Gold/Silver or account type tabs.                                       |
| `ToastProvider`        | Global toast feedback.                                                                           |
| `SectionErrorBoundary` | Recoverable section-level failure UI.                                                            |
| `RetrySyncScreen`      | Startup recovery when sync/profile state is unsafe.                                              |

`PageHeader` remains the default for private screens. New header variations
should be folded into `PageHeader` unless a screen has a proven specialized
need.

## 4. Shared Class Compounds

`apps/mobile/global.css` defines reusable class compounds:

- `input-label`
- `input-error`
- `subtitle-text`
- `body-text`
- `body-small`
- `caption-text`
- `stat-label`
- `stat-value`

When the same class combination repeats across components, add a compound in
`global.css` instead of duplicating it across files.

## 5. Styling Rules

Preferred:

- NativeWind `className`.
- `dark:` variants for theme differences.
- Semantic Tailwind tokens for backgrounds, cards, borders, and text.
- `palette` imports only for props that require raw color values, such as icon
  color, gradient stops, placeholder color, or third-party component props.

Allowed inline style exceptions:

- Dynamic computed values, such as width percentages.
- Safe-area padding from runtime insets.
- NativeWind v4 crash workarounds on `TouchableOpacity` and `Pressable` for
  `shadow-*`, `opacity-*`, and `bg-color/opacity`.
- Third-party component props that do not accept `className`.

Do not add raw hex values, new unsupported `StyleSheet.create()` usages, or
static inline color styles in JSX.

## 6. Migration Guide

For v1 dashboard, metals, add holding, and accounts work:

- Prefer `bg-app` over `bg-background` for full-screen v1 surfaces.
- Prefer `bg-card`, `bg-card-muted`, and `bg-glass` over direct `bg-white`,
  `bg-slate-*`, or `dark:bg-slate-*` card styling.
- Prefer `text-text-*`, `text-action`, `text-success`, and `text-danger` over
  raw slate/green/red text classes.
- Prefer `border-border-card`, `border-border-subtle`, and `border-border-glass`
  over direct slate borders.
- Use `AppCard`, `GlassCard`, `MetricCard`, `InlineNotice`, and
  `SegmentedControl` as the foundation for approved mockup sections.
- Keep imagery as assets. Pyramids, Cairo skyline, gold bars, silver coins, and
  account logos are not theme tokens.

## 7. Loading And Progress

Content loading should use skeleton layouts built from `Skeleton`. The skeleton
primitive uses theme tokens so placeholders match warm light mode and deep dark
mode.

Allowed spinner use:

- Short button/action progress.
- Inline action confirmation where content is already visible.

Avoid spinner use for whole-screen content loading.

## 8. Layout, Safe Areas, And RTL

Rules:

- Root `SafeAreaProvider` must pass `initialWindowMetrics`.
- Apply top inset once per screen.
- Prefer `PageHeader` for header safe-area handling.
- Use `FlatList` or `SectionList` for long lists.
- Keep bottom padding aware of tab bars, FABs, and modal sheets.
- Continue using namespace-based i18n and locale-aware typography.

## 9. Documentation Checklist

When changing a major screen or shared UI primitive, update this document if the
change affects:

- Theme tokens or Tailwind class names.
- Shared class compounds.
- Reusable component guidance.
- Header or safe-area conventions.
- Loading-state patterns.
- RTL/localization behavior.
- Allowed styling exceptions.
