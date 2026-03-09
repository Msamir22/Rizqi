# Data Model: Logout Flow

**Feature**: 015-logout-flow **Date**: 2026-03-08

## Entities

This feature does not introduce new database tables or schema changes. It
operates on existing entities and AsyncStorage keys.

### AsyncStorage Keys (New)

| Key                         | Type              | Lifecycle                                          | Purpose                   |
| --------------------------- | ----------------- | -------------------------------------------------- | ------------------------- |
| `@astik/logout-in-progress` | `"true"` / absent | Set before logout starts, removed after completion | Force-close recovery flag |

### AsyncStorage Keys (Existing — Cleared on Logout)

| Key                                       | Constant                               | Purpose                |
| ----------------------------------------- | -------------------------------------- | ---------------------- |
| `@astik/first-use-date`                   | `FIRST_USE_DATE_KEY`                   | Sign-up prompt trigger |
| `@astik/signup-prompt-dismissed-at`       | `SIGNUP_PROMPT_DISMISSED_AT_KEY`       | Prompt cooldown        |
| `@astik/signup-prompt-dismissed-tx-count` | `SIGNUP_PROMPT_DISMISSED_TX_COUNT_KEY` | Prompt cooldown        |
| `@astik/signup-prompt-never-show`         | `SIGNUP_PROMPT_NEVER_SHOW_KEY`         | "Never show" flag      |

### AsyncStorage Keys (Existing — Preserved on Logout)

| Key            | Constant            | Purpose                            |
| -------------- | ------------------- | ---------------------------------- |
| `hasOnboarded` | `HAS_ONBOARDED_KEY` | Device-level onboarding completion |

### State Transitions

```
Signed-In User → [Taps Logout] → Confirmation Modal
  → [Confirms] → Network Check → Sync → DB Reset → Session Destroy → Anonymous Session → Home
  → [Cancels] → No change
  → [No Network] → Error toast, no action
  → [Sync Fails] → Retry once → [Still Fails] → Warning Modal → [Proceed/Cancel]
```

## No Schema Migrations Required

This feature only reads/resets the local database and manages AsyncStorage
flags. No Supabase migrations or WatermelonDB schema changes are needed.
