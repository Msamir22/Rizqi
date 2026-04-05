# Data Model: Arabic Localization

**Feature**: 023-arabic-localization **Date**: 2026-04-05

## Overview

This feature introduces no new database tables or columns. All localization data
is bundled as static JSON files in the app. The only persistent state is the
user's language preference stored in AsyncStorage.

## Entities

### Language Preference (AsyncStorage)

| Field | Type   | Description                        |
| ----- | ------ | ---------------------------------- |
| key   | string | `@astik/language`                  |
| value | string | `"en"` or `"ar"` (ISO 639-1 codes) |

**Lifecycle**:

- Created on first app launch (auto-detected from device locale) or during
  onboarding language selection step.
- Updated when user changes language in Settings or onboarding.
- Read on every app launch to initialize i18next and I18nManager.
- Never deleted (persists across sessions, survives app updates).
- Cleared on logout (included in `CLEARABLE_USER_KEYS`).

### Translation Resource (Bundled JSON)

| Field     | Type   | Description                                   |
| --------- | ------ | --------------------------------------------- |
| namespace | string | Feature area (e.g., `common`, `transactions`) |
| locale    | string | Language code (`en` or `ar`)                  |
| keys      | object | Flat key-value pairs of translation strings   |

**Structure**: Organized by namespace. Each namespace has an `en` and `ar` JSON
file. Keys use dot-separated hierarchical naming within each file.

**Plural keys** follow i18next convention:

- `key_one` — singular (count = 1)
- `key_two` — dual (count = 2)
- `key_other` — plural (count >= 3 or 0)

### Category Translation Mapping

Categories in WatermelonDB have a `system_name` field (e.g., `food_drinks`,
`groceries`). The translation files contain a `categories` namespace that maps
each `system_name` to its localized display name:

```json
// en/categories.json
{
  "food_drinks": "Food & Drinks",
  "groceries": "Groceries",
  "transportation": "Transportation"
}

// ar/categories.json
{
  "food_drinks": "أكل وشرب",
  "groceries": "بقالة",
  "transportation": "مواصلات"
}
```

Components render `t('categories:' + category.systemName)` instead of
`category.displayName`.

### Account Type Translation Mapping

Account types are hardcoded in `constants/accounts.ts`. The translation files
contain an `accounts` namespace with type labels:

```json
// en/accounts.json
{ "type_cash": "Cash", "type_bank": "Bank Account", "type_digital_wallet": "Digital Wallet" }

// ar/accounts.json
{ "type_cash": "كاش", "type_bank": "حساب بنكي", "type_digital_wallet": "محفظة إلكترونية" }
```

## No Database Migrations Required

This feature does not:

- Add new tables
- Modify existing columns
- Add new columns to existing tables
- Change sync behavior

All localization data is static and bundled with the app binary.
