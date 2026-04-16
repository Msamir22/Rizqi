# Session: Onboarding Guide Card Redesign + SMS Permission Gate + Dashboard Bug Fixes

**Date:** 2026-04-16 **Time:** ~16:00 - 20:00 **Duration:** ~4 hours

---

## Summary

This session continued from a previous compacted conversation (PR #215 dashboard
module audit). The main work focused on three areas: (1) fixing runtime bugs
reported after testing the OnboardingGuideCard on a real Android device, (2)
adding an SMS permission gate to the `/sms-scan` route, and (3) redesigning the
OnboardingGuideCard as a compact expandable card using Stitch mockups.

Multiple rounds of real-device testing identified issues with WatermelonDB
reactive observations, NativeWind dark mode class resolution, and Android
permission flow UX. All were fixed iteratively. Three GitHub issues were created
for out-of-scope work.

**Branch:** `fix/onboarding-sms-permission` **PR:** #218

---

## What Was Accomplished

### Files Created

| File                                             | Purpose                                           |
| ------------------------------------------------ | ------------------------------------------------- |
| (Stitch screens in project 13253418811527315493) | 4 compact mockup variants for OnboardingGuideCard |

### Files Modified

| File                                                       | Changes                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/mobile/hooks/useOnboardingGuide.ts`                  | observeWithColumns fix + store primitive value for reactivity |
| `apps/mobile/app/sms-scan.tsx`                             | SMS permission gate + auto-request on first mount             |
| `apps/mobile/hooks/useSmsPermission.ts`                    | Preserve denied/blocked status on AppState refocus            |
| `apps/mobile/components/dashboard/OnboardingGuideCard.tsx` | Full redesign: expandable compact card (Mockup 4)             |
| `apps/mobile/components/dashboard/TotalNetWorthCard.tsx`   | adjustsFontSizeToFit for currency wrapping                    |
| `apps/mobile/app/(tabs)/index.tsx`                         | Moved OnboardingGuideCard above TotalNetWorthCard + dark fix  |
| `apps/mobile/locales/en/common.json`                       | Added `go`, `open_settings` keys                              |
| `apps/mobile/locales/ar/common.json`                       | Added `go`, `open_settings` keys (Arabic)                     |

### Key Decisions Made

1. **Expandable compact card design:** User chose Mockup 4 (expandable compact
   card) over 3 other options. Collapsed by default (~90px), expandable to show
   all 5 steps. X dismiss on collapsed state.
2. **Store primitives not record refs:** WatermelonDB mutates records in place.
   Storing the whole profile object in useState causes React to bail out of
   re-renders (same reference). Store the boolean field value separately.
3. **Auto-request SMS permission on first mount:** The gate page was an
   unnecessary extra step for first-time users. Now auto-calls
   requestPermission() for "undetermined" status; visible gate only appears for
   denied/blocked.
4. **Replace text-text-primary with explicit classes:** The `text-text-primary`
   NativeWind class is broken in dark mode due to tailwind config structure.
   Workaround: use `text-slate-800 dark:text-slate-25` directly.

---

## Business Logic Changes

No business logic changes in this session.

---

## Technical Details

### WatermelonDB observe() vs observeWithColumns() vs record.observe()

- `.observe()` on a query only re-emits when records are added/removed from the
  result set.
- `.observeWithColumns(["col"])` fires when the specified columns change on ANY
  record in the result.
- BUT: React's `useState` does reference equality checks. WatermelonDB records
  are mutable objects — the same reference is emitted even after field changes.
  So `setState(sameRef)` bails out.
- **Fix:** Store the primitive field value in a separate `useState`, not the
  record object itself.

### Android PermissionsAndroid.check() limitation

- `check()` only returns a boolean (granted or not). Cannot distinguish
  undetermined/denied/blocked.
- Only `request()` returns that detail (via GRANTED/DENIED/NEVER_ASK_AGAIN).
- The AppState "active" listener was calling `check()` after the native
  permission dialog closed, which reset status to "undetermined" — clobbering
  the denied/blocked result from request().
- **Fix:** Only positively set "granted"; preserve non-granted states.

### NativeWind text-text-primary dark mode bug

- `tailwind.config.js` uses `{ DEFAULT: lightColor, dark: darkColor }` which
  generates `text-text-primary` (light) and `text-text-primary-dark` (suffix).
- NativeWind's `dark:` prefix does NOT auto-map the `.dark` key — you must write
  `dark:text-text-primary-dark` explicitly.
- **Workaround:** Use explicit `text-slate-800 dark:text-slate-25` pattern.
- **Issue #221** tracks fixing this at the config level (CSS variables
  approach).

---

## Pending Items

- [ ] Test all fixes on real device (dismiss reactivity, SMS permission flow,
      currency wrapping)
- [ ] Fix `text-text-primary` at the tailwind config level (#221)
- [ ] Implement selective sync for pull-to-refresh (#219)
- [ ] Replace native Android permission alerts with custom in-app modal (#220)
- [ ] Card design visual polish (user may want further adjustments after
      testing)

---

## Context for Next Session

- **Branch:** `fix/onboarding-sms-permission` with PR #218 open
- **5 commits** on the branch; all lint/i18n checks pass
- Three new GitHub issues created: #219 (selective sync), #220 (custom SMS
  permission modal), #221 (text-text-primary config fix)
- The user is actively testing on a real Android device and reporting bugs.
  Expect further UI feedback.
- The `text-text-primary` class is broken across 10+ files in the app. Only 3
  files were fixed in this session; the rest are tracked by #221.
- The Stitch mockup project `13253418811527315493` contains the 4 compact card
  variants if future reference is needed.
