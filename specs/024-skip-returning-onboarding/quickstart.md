# Quickstart: Skip Onboarding for Returning Users

**Branch**: `024-skip-returning-onboarding`

This is the hand-off doc for whoever picks up implementation. Read it before
running `/speckit.tasks` or `/speckit.implement`.

## TL;DR

We're replacing the AsyncStorage-based onboarding gate with a
server-authoritative gate driven by `profiles.onboarding_completed`. The work
splits into:

1. **Migration** — two new columns on `profiles`.
2. **Sync wiring** — `SyncProvider` exposes a blocking `initialSyncState`;
   `index.tsx` awaits it.
3. **Gate rewrite** — `index.tsx` routes based on profile state instead of
   AsyncStorage.
4. **Onboarding rewrite** — persist each step's output to the profile via
   `profile-service.ts`, read the initial phase from the profile.
5. **Currency-step change** — remove the Skip button (FR-009).
6. **Retry screen** — new component; **blocked on mockups**.
7. **Observability** — one info-level log per routing decision.
8. **Tests** — unit + integration, TDD-first.

## Prerequisites before opening the first PR

- [x] **Retry-screen mockups** — approved 2026-04-18. V2 "Status Card" saved at
      `specs/024-skip-returning-onboarding/mockups/retry-sync-screen.png` and
      `.html`. See T032 for the implementation spec.
- [x] **Currency-step signal** — approved 2026-04-18. Using **Option B**:
      cash-account presence (via `hasCashAccount`) is the "user completed
      currency step" signal. No `handle_new_user()` trigger audit required.

## Running the migration locally

```bash
# 1. Write the SQL file
$EDITOR supabase/migrations/040_add_language_and_slides_viewed_to_profiles.sql
# (content in data-model.md § 6)

# 2. Push to remote Supabase and regenerate local schema
npm run db:push
npm run db:migrate

# 3. Commit both files in the SAME commit (per Constitution VII)
git add supabase/migrations/040_add_language_and_slides_viewed_to_profiles.sql \
        packages/db/src/schema.ts \
        packages/db/src/migrations.ts \
        packages/db/src/supabase-types.ts \
        packages/db/src/models/base/base-profile.ts
git commit -m "feat: add preferred_language and slides_viewed to profiles"
```

Expected diff in `packages/db/src/migrations.ts`: a new migration step that adds
two columns to the `profiles` table and bumps the schema version by 1.

## Local development loop

```bash
# Run the mobile app
npm --workspace apps/mobile run start

# Run the focused test file while iterating
npm --workspace apps/mobile test -- routing-decision
npm --workspace apps/mobile test -- profile-service
npm --workspace apps/mobile test -- app/index
```

## Manual verification checklist

After implementation, walk through these with a real build:

- [ ] **New user**: sign up from scratch → Language → Slides → Currency →
      Cash-account confirmation → Dashboard. Expect cash account visible in the
      account list.
- [ ] **Returning user same device**: complete the flow, force-close the app,
      re-open → lands on Dashboard directly. No onboarding shown.
- [ ] **Returning user fresh install**: complete the flow on device A, sign in
      on a clean install of device A (clear data) → `InitialSyncOverlay` shown
      briefly, then Dashboard. No onboarding shown.
- [ ] **Partial resume — language set only**: seed a profile with
      `preferred_language='en'` but `slides_viewed=false`, sign in → land on
      Slides step (not Language).
- [ ] **Partial resume — through slides**: seed with `preferred_language='en'`,
      `slides_viewed=true`, no cash account, `onboarding_completed=false` → land
      on Currency step.
- [ ] **Partial resume — through currency**: seed with cash account present,
      `onboarding_completed=false` → land on Cash-account confirmation (last
      step).
- [ ] **Slow network**: throttle to 3G, sign in → overlay stays visible up to
      20s. If sync completes inside the window → correct route. If not → Retry
      screen.
- [ ] **Retry screen — Retry action**: on the retry screen with server restored,
      tap Retry → overlay returns, then routes to Dashboard.
- [ ] **Retry screen — Sign out action**: on the retry screen, tap Sign out →
      returns to `/auth`.
- [ ] **Currency step is mandatory**: no Skip button visible, Continue disabled
      until a currency is selected.
- [ ] **Observability**: verify one `onboarding.routing.decision` log event per
      app launch in Sentry or local log output; payload matches the shape in
      `contracts/profile-service.ts`.
- [ ] **No AsyncStorage dependency**: grep for `HAS_ONBOARDED_KEY` and
      `LANGUAGE_KEY` in new code — only references should be the
      `constants/storage-keys.ts` file (kept for legacy reads during migration)
      and deprecation comments.

## Files to expect in the PR

Per `plan.md § Project Structure` — no new files in `packages/logic`, no changes
to any tabs screen. If you find yourself touching anything outside
`apps/mobile/` and `packages/db/` (plus the single migration file), re-read the
plan.

## Known gotchas

- **NativeWind v4 crash**: the retry screen's Retry and Sign-out buttons must
  not use `shadow-*`, `opacity-*`, or `bg-color/opacity` classes on
  `TouchableOpacity`/`Pressable`. Inline `style` for shadow/elevation — see
  `WalletCreationStep.tsx` lines 230-241 for the existing pattern.
- **`preferredCurrency` hook typing**: `usePreferredCurrency` already returns
  `CurrencyType` (never null) via device-timezone fallback. That's fine for
  display. For the routing gate's `hasCashAccount` input, query `accounts`
  collection directly — don't rely on the `preferredCurrency` hook.
- **Profile row might not exist immediately after sign-up**: the Supabase
  `handle_new_user()` trigger creates it, and the initial pull-sync brings it
  down. Guard against an empty observation — if no profile row exists after sync
  reports `success`, treat it as a new user (route to Language step). Log this
  as an unexpected state.
- **i18n change during Language step**: `changeLanguage(language)` is async;
  await it before routing to Slides so the Slides carousel renders in the right
  language.
- **AsyncStorage `HAS_ONBOARDED_KEY`**: do NOT read from it in new code. The
  gate must not silently honor a legacy true value — it would undo the whole
  point of the feature.

## When you're done

- [ ] Run `/speckit.analyze` to cross-check spec ↔ plan ↔ tasks ↔ code
      alignment.
- [ ] Update `docs/business/business-decisions.md` per Constitution II (recorded
      as a task).
- [ ] Delete or downgrade the dev-only `logger` calls if they're noisy; keep the
      one in the gate.
- [ ] File a follow-up issue: "Remove `HAS_ONBOARDED_KEY` and `LANGUAGE_KEY`
      AsyncStorage legacy reads once pre-release devices have flowed through the
      new onboarding at least once."
