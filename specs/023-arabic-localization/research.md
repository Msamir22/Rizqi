# Research: Arabic Localization

**Feature**: 023-arabic-localization **Date**: 2026-04-05

## 1. i18n Framework Selection

**Decision**: `i18next` + `react-i18next`

**Rationale**: Most mature and widely adopted i18n library for React Native.
Supports namespaces, interpolation, Arabic plural rules (via
`Intl.PluralRules`), fallback languages, and JSX interpolation via `<Trans>`
component. Pairs natively with `expo-localization` for device locale detection.

**Alternatives considered**:

- `i18n-js`: Simpler but lacks namespace support, weaker pluralization, smaller
  ecosystem. Suitable for small apps but not for 27+ screens with complex plural
  rules.
- `react-intl` (FormatJS): Web-first, heavier bundle, less React Native
  community adoption.
- Custom solution: Too much effort to build plural rules, fallback chains, and
  interpolation from scratch.

## 2. RTL Layout Strategy

**Decision**: `I18nManager.forceRTL()` + `expo-updates` reload

**Rationale**: React Native's Yoga layout engine automatically flips
`flexDirection: 'row'` when `I18nManager.isRTL` is true. This is the
platform-standard approach. However, `forceRTL()` requires a JS bundle reload to
take effect — it cannot be applied instantly without a reload.

**Impact on FR-004 (immediate language switch)**: The spec requires language
changes without "requiring an app restart." The JS bundle reload via
`Updates.reloadAsync()` is not a cold app restart — it's a hot reload taking
~1-2 seconds. A brief splash/loading screen can mask the transition. This is the
standard pattern used by major Arabic-supporting apps (e.g., Careem, Swvl).

**Required config**: Add `"supportsRTL": true` to `app.json` under `expo.extra`.
Must use a development build (not Expo Go) for RTL testing.

**Alternatives considered**:

- Context-based RTL at component level: Would avoid reload but loses Yoga's
  automatic flexDirection flipping. Requires manually wrapping every layout.
  Rejected — too fragile and labor-intensive for 27 screens.

## 3. NativeWind RTL Compatibility

**Decision**: Replace directional utilities with logical properties

**Rationale**: NativeWind v4 supports Tailwind's logical property utilities.
Yoga auto-flips `flexDirection` in RTL mode, but explicit `ml-*`, `mr-*`,
`pl-*`, `pr-*` do NOT auto-flip. Must use logical equivalents.

**Migration map**:

| Current (LTR-only) | Replace with (RTL-safe) |
| ------------------ | ----------------------- |
| `ml-*`             | `ms-*` (margin-start)   |
| `mr-*`             | `me-*` (margin-end)     |
| `pl-*`             | `ps-*` (padding-start)  |
| `pr-*`             | `pe-*` (padding-end)    |
| `text-left`        | `text-start`            |
| `text-right`       | `text-end`              |
| `left-*`           | `start-*`               |
| `right-*`          | `end-*`                 |
| `rounded-l-*`      | `rounded-s-*`           |
| `rounded-r-*`      | `rounded-e-*`           |

**No change needed for**: `flex-row` (Yoga auto-flips), `justify-between`,
`items-center`, `gap-*`, symmetric `px-*`, `py-*`, `mx-*`, `my-*`.

## 4. Arabic Font Support

**Decision**: Add Noto Sans Arabic as the Arabic font family alongside Inter

**Rationale**: Inter does NOT support Arabic characters. Arabic text rendered
with Inter falls back to the system default font, causing visual inconsistency
with the premium UI principle. Noto Sans Arabic is Google's open-source font
with excellent Arabic glyph coverage and weight parity with Inter (400-700).

**Implementation**: Load both font families via `expo-font`. Create a
locale-aware font selector that returns the appropriate font family based on the
active language.

**Alternatives considered**:

- System font fallback only: Inconsistent across iOS/Android, violates
  Constitution Principle V (Premium UI).
- Cairo font: Popular Arabic font but limited weight range. Noto Sans Arabic has
  better weight parity with Inter.
- IBM Plex Arabic: Good quality but less common in mobile apps.

## 5. Translation File Organization

**Decision**: Namespace-based JSON files per feature area

**Rationale**: With 27 screens and 16 functional requirements, a single flat
translation file would become unwieldy. Namespaced files allow parallel
translation work and smaller change diffs.

**Structure**:

```
apps/mobile/locales/
├── en/
│   ├── common.json        # Shared: buttons, labels, errors, navigation
│   ├── tabs.json           # Tab bar labels
│   ├── transactions.json   # Transaction screens
│   ├── accounts.json       # Account screens
│   ├── budgets.json        # Budget screens
│   ├── settings.json       # Settings screen
│   ├── onboarding.json     # Onboarding flow
│   ├── auth.json           # Auth screens
│   └── metals.json         # Metals/rates screens
└── ar/
    └── [same structure]
```

**Alternatives considered**:

- Single `en.json` / `ar.json`: Simpler but doesn't scale. 27 screens would
  produce 500+ keys in one file.
- Per-screen files: Too granular. Shared strings (buttons, errors) would
  duplicate across files.

## 6. Category Translation Strategy

**Decision**: Translate category `display_name` via i18n translation keys keyed
by `system_name`

**Rationale**: Categories are seeded in Supabase with a `system_name` (e.g.,
`food_drinks`) and a `display_name` (e.g., `Food & Drinks`). Rather than
modifying the database schema to add an `ar_display_name` column, use the
`system_name` as a translation key. The component renders
`t('categories.' + category.system_name)` instead of `category.display_name`.

This approach:

- Requires no database migration
- Keeps translations in the same i18n system as all other strings
- Works offline (bundled translations)
- Scales to future languages without schema changes

**Alternatives considered**:

- Add `display_name_ar` column to categories table: Requires migration, breaks
  Constitution Principle I (offline-first requires sync for new translations),
  doesn't scale beyond 2 languages.
- Inline mapping object: Works but fragments translation management across two
  systems (i18n files + inline maps).

## 7. Date Formatting

**Decision**: Use `toLocaleDateString('ar-EG')` with Gregorian calendar options

**Rationale**: The native JavaScript `Intl.DateTimeFormat` (supported by Hermes
engine) correctly formats Gregorian dates with Arabic month names when given the
`ar-EG` locale. This avoids adding an external date library.

**Example**:

```ts
new Date().toLocaleDateString("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
// → "٥ أبريل ٢٠٢٦"
```

The existing `dateHelpers.ts` utility functions need locale-aware variants.

## 8. Language Preference Persistence

**Decision**: AsyncStorage with key `@astik/language`

**Rationale**: AsyncStorage is already used for app preferences
(`storage-keys.ts`). Language preference is not sensitive data, so SecureStore
is unnecessary. The key follows the existing `@astik/` prefix convention.

**Flow**:

1. First launch: Detect via `expo-localization` → `getLocales()[0].languageCode`
2. If Arabic detected → default to `ar`, else `en`
3. User selection (onboarding or settings) → write to AsyncStorage
4. Subsequent launches → read AsyncStorage first, fallback to device locale

## 9. Plural Form Strategy

**Decision**: Use i18next's built-in `Intl.PluralRules` with simplified keys
(singular `_one`, dual `_two`, plural `_other`)

**Rationale**: The spec calls for "simplified — singular, dual, and plural
only." i18next resolves Arabic plural categories automatically. We provide
`_one`, `_two`, and `_other` keys. The `_few` and `_many` categories fall
through to `_other`. This is a pragmatic simplification that covers the vast
majority of UI display cases in a financial app.
