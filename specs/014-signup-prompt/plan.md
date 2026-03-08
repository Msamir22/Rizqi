# Implementation Plan: Optional Sign-Up Prompt

**Branch**: `014-signup-prompt` | **Date**: 2026-03-05 | **Spec**:
[spec.md](spec.md)
**Input**: Feature specification from `/specs/014-signup-prompt/spec.md`

## Summary

Implement an optional sign-up prompt system that encourages anonymous users to
create a permanent account, protecting their data from loss. Three UI surfaces
(post-onboarding full-screen, re-engagement urgency bottom sheet, Settings
gradient banner) guide anonymous users to sign up. Account conversion uses
Supabase's `linkIdentity()` with Google, Facebook, and Apple (iOS-only) OAuth
providers. No data migration is needed — the existing `user_id` is preserved.

## Technical Context

**Language/Version**: TypeScript (strict mode)  
**Primary Dependencies**: React Native + Expo 52, Supabase JS v2, WatermelonDB,
NativeWind v4, expo-auth-session, expo-web-browser, expo-crypto  
**Storage**: WatermelonDB (local), Supabase (cloud), AsyncStorage (prompt
dismissal state)  
**Testing**: Jest + React Native Testing Library  
**Target Platform**: Android (primary), iOS (future)  
**Project Type**: Mobile (monorepo)  
**Performance Goals**: OAuth flow < 30 seconds, no UI jank on prompt display  
**Constraints**: Offline-capable (prompts still need network for OAuth), no data
loss on conversion  
**Scale/Scope**: Single-user app, 3 new screens/components, 1 hook, 2 service
functions

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                             | Status  | Notes                                                                                                                                         |
| ------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Offline-First                      | ✅ PASS | Prompts use AsyncStorage (local). OAuth requires network but auth failure doesn't affect data. WatermelonDB data untouched during conversion. |
| II. Documented Business Logic         | ✅ PASS | `business-decisions.md` updated with Apple (iOS) and Facebook auth methods.                                                                   |
| III. Type Safety                      | ✅ PASS | All new code uses strict TypeScript. No `any`. Interfaces for all props/state.                                                                |
| IV. Service-Layer Separation          | ✅ PASS | OAuth logic in `services/auth-service.ts`. Prompt hook in `hooks/useSignUpPrompt.ts`. Components only render.                                 |
| V. Premium UI with Consistent Theming | ✅ PASS | NativeWind classes for all styling. Gradient banner uses theme palette. Reanimated for animations.                                            |
| VI. Monorepo Package Boundaries       | ✅ PASS | All changes in `apps/mobile/`. No cross-package violations.                                                                                   |
| VII. Local-First Migrations           | ✅ PASS | No database schema changes needed. Auth state comes from Supabase auth, not DB.                                                               |

## Project Structure

### Documentation (this feature)

```text
specs/014-signup-prompt/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── spec.md              # Feature specification
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/mobile/
├── app/
│   ├── _layout.tsx                    # [MODIFY] Add sign-up route to Stack
│   ├── onboarding.tsx                 # [MODIFY] Route to sign-up after wallet creation
│   ├── sign-up.tsx                    # [NEW] Full-screen sign-up page
│   └── settings.tsx                   # [MODIFY] Add gradient banner for anonymous users
├── components/
│   └── sign-up/
│       ├── SignUpBanner.tsx            # [NEW] Settings gradient banner component
│       ├── SignUpPromptSheet.tsx       # [NEW] Urgency bottom sheet component
│       └── SocialLoginButtons.tsx     # [NEW] Reusable Google/Facebook/Apple buttons
├── context/
│   └── AuthContext.tsx                # [MODIFY] Add isAnonymous flag
├── hooks/
│   └── useSignUpPrompt.ts            # [NEW] Prompt visibility & dismissal logic
├── services/
│   ├── supabase.ts                    # [MODIFY] Add linkIdentity wrapper
│   └── auth-service.ts               # [NEW] OAuth flow orchestration
└── constants/
    └── auth.ts                        # [NEW] AsyncStorage keys, thresholds
```

**Structure Decision**: All changes within `apps/mobile/` following existing
monorepo conventions. New files grouped under `components/sign-up/` for sign-up
UI components, a new `services/auth-service.ts` for auth orchestration, and a
new `hooks/useSignUpPrompt.ts` for prompt logic.

---

## Detailed Changes

### Phase 1: Auth Infrastructure

#### [NEW] `apps/mobile/constants/auth.ts`

Constants for prompt thresholds and AsyncStorage keys:

- `SIGNUP_TX_THRESHOLD = 50` — trigger urgency prompt at ≥ 50 transactions
- `SIGNUP_DAYS_THRESHOLD = 10` — trigger urgency prompt at ≥ 10 days
- `SIGNUP_COOLDOWN_TX = 50` — additional transactions before re-triggering
- `SIGNUP_COOLDOWN_DAYS = 10` — additional days before re-triggering
- AsyncStorage keys: `@astik/signup-prompt-dismissed-at`,
  `@astik/signup-prompt-dismissed-tx-count`, `@astik/signup-prompt-never-show`

---

#### [MODIFY] `apps/mobile/context/AuthContext.tsx`

Add `isAnonymous` to the context value:

```diff
 interface AuthContextValue {
   user: User | null;
   session: Session | null;
   isLoading: boolean;
   isAuthenticated: boolean;
+  isAnonymous: boolean;
   signOut: () => Promise<void>;
 }
```

Derive from Supabase user:

```diff
+  const isAnonymous = user?.is_anonymous ?? false;
+
   const value: AuthContextValue = {
     user,
     session,
     isLoading,
     isAuthenticated: !!session,
+    isAnonymous,
     signOut,
   };
```

---

#### [MODIFY] `apps/mobile/services/supabase.ts`

Add `linkIdentityWithProvider()` wrapper function:

```typescript
export async function linkIdentityWithProvider(
  provider: "google" | "facebook" | "apple"
): Promise<{ url: string } | { error: Error }> {
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: {
      redirectTo: `${YOUR_SCHEME}://auth-callback`,
    },
  });
  if (error) return { error };
  return { url: data.url };
}
```

---

#### [NEW] `apps/mobile/services/auth-service.ts`

OAuth flow orchestration service:

- `initiateOAuthLink(provider)` — opens browser with Supabase OAuth URL, handles
  redirect back to app
- `isAccountConversionComplete(user)` — check if `is_anonymous === false`
- Error handling for network failures, duplicate accounts, cancelled flows

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used**: Service-Layer Separation (Constitution IV)
> - **Why**: OAuth orchestration involves browser interaction, network calls,
>   and error handling — none of which belongs in components or hooks.
> - **SOLID Check**: Single Responsibility — this service only handles OAuth
>   flows.

---

### Phase 2: Sign-Up Screen & Components

#### [NEW] `apps/mobile/app/sign-up.tsx`

Full-screen sign-up page (used post-onboarding and from Settings):

- Trust badges: "🔒 Encrypted", "☁️ Backed Up", "🛡️ Private"
- Title: "Secure Your Financial Data"
- Subtitle explaining data protection benefits
- `SocialLoginButtons` component
- "I'll do it later" skip button at bottom
- Receives `source` param to distinguish post-onboarding vs Settings entry
- On success: show toast "Account secured ✓" → navigate to `/(tabs)`
- On skip: navigate to `/(tabs)` directly

---

#### [NEW] `apps/mobile/components/sign-up/SocialLoginButtons.tsx`

Reusable component rendering platform-appropriate OAuth buttons:

- Google Sign-In button (all platforms)
- Facebook Sign-In button (all platforms)
- Apple Sign-In button (iOS only, conditionally rendered via `Platform.OS`)
- Loading state during OAuth flow
- Error feedback via toast
- Accepts `onSuccess` and `onError` callbacks

---

#### [NEW] `apps/mobile/components/sign-up/SignUpBanner.tsx`

Settings gradient banner for anonymous users:

- Emerald green gradient background (using `palette.nileGreen`)
- Shield/lock icon
- "Secure Your Account" heading
- "Your data is only on this device" subtext
- "Sign Up" button → navigates to `/sign-up`
- Hidden for authenticated (non-anonymous) users

---

#### [NEW] `apps/mobile/components/sign-up/SignUpPromptSheet.tsx`

Urgency bottom sheet modal:

- Shows real user stats: transaction count, account count, total amount tracked
- "⚠️ You could lose all of this" urgency messaging
- `SocialLoginButtons` component
- "Skip for now" → cooldown dismiss
- "Never show this again" → permanent dismiss
- Animated entrance/exit using Reanimated

---

#### [MODIFY] `apps/mobile/app/_layout.tsx`

Add `sign-up` route:

```diff
         <Stack.Screen name="sms-scan" />
         <Stack.Screen name="sms-review" />
+        <Stack.Screen name="sign-up" />
       </Stack>
```

---

#### [MODIFY] `apps/mobile/app/onboarding.tsx`

Route to sign-up screen after wallet creation for anonymous users:

```diff
   const handleGoToApp = useCallback((): void => {
-    router.replace("/(tabs)");
+    // Show sign-up prompt for anonymous users after onboarding
+    if (isAnonymous) {
+      router.replace("/sign-up?source=onboarding");
+    } else {
+      router.replace("/(tabs)");
+    }
-  }, [router]);
+  }, [router, isAnonymous]);
```

---

#### [MODIFY] `apps/mobile/app/settings.tsx`

Add `SignUpBanner` at top of Settings ScrollView:

```diff
+  const { isAnonymous } = useAuth();
+
   return (
     ...
     <ScrollView ...>
+      {isAnonymous && <SignUpBanner />}
       {/* existing settings content */}
     </ScrollView>
```

---

### Phase 3: Prompt Trigger Logic

#### [NEW] `apps/mobile/hooks/useSignUpPrompt.ts`

Custom hook that centralizes all prompt visibility logic:

- `shouldShowPrompt: boolean` — computed from:
  1. User is anonymous
  2. Not permanently suppressed
  3. Cooldown expired (50+ additional txns OR 10+ additional days since dismiss)
- `dismissWithCooldown()` — records current timestamp and tx count
- `dismissPermanently()` — sets never-show flag
- `promptStats` — `{ transactionCount, accountCount, totalAmount }` for the
  urgency sheet
- Uses `useAuth()` for `isAnonymous` check
- Uses WatermelonDB `database.get('transactions').query().fetchCount()` for
  counts

> **🛡️ Architecture & Design Rationale**
>
> - **Pattern Used**: Strategy Pattern (for dismiss behavior variants)
> - **Why**: Two distinct dismiss strategies (cooldown vs permanent) with
>   identical interfaces encapsulated in one hook.
> - **SOLID Check**: Open/Closed — adding new dismiss strategies doesn't require
>   modifying existing ones.

---

#### Integration in Tab Layout

The urgency prompt triggers on cold app launch. Integration options:

- Mount `SignUpPromptSheet` in `apps/mobile/app/(tabs)/_layout.tsx`
- `useSignUpPrompt` hook checks conditions on mount
- Only evaluates once per cold launch (tracked via `useRef`)

---

### Phase 4: Package Installation

New dependencies (installed via `npx expo install`):

- `expo-auth-session` — OAuth session management
- `expo-web-browser` — system browser for OAuth
- `expo-crypto` — peer dependency for `expo-auth-session`

---

## Verification Plan

### Automated Tests

#### Unit Tests: `useSignUpPrompt` hook

Location: `apps/mobile/__tests__/hooks/useSignUpPrompt.test.ts`

Test cases:

- Anonymous user below thresholds → `shouldShowPrompt = false`
- Anonymous user at 50+ txns → `shouldShowPrompt = true`
- Anonymous user at 10+ days → `shouldShowPrompt = true`
- After cooldown dismiss → `shouldShowPrompt = false` immediately
- After cooldown expires (50+ additional txns) → `shouldShowPrompt = true`
- After permanent dismiss → `shouldShowPrompt = false` forever
- Authenticated user → `shouldShowPrompt = false` regardless

**Run**: `npm test -w @astik/mobile -- --testPathPattern=useSignUpPrompt`

---

#### Unit Tests: Auth service

Location: `apps/mobile/__tests__/services/auth-service.test.ts`

Test cases:

- `initiateOAuthLink('google')` calls `linkIdentity` with correct provider
- Network error returns error object
- Cancelled OAuth does not corrupt state

**Run**: `npm test -w @astik/mobile -- --testPathPattern=auth-service`

---

### Manual Verification

> **Note**: These tests require running the app on a real device or emulator
> with the Expo development build.

#### Test 1: Post-Onboarding Sign-Up Flow

1. Clear app data / fresh install
2. Complete onboarding (carousel → currency picker → wallet creation)
3. **Verify**: Full-screen sign-up page appears with trust badges and social
   login buttons
4. Tap "I'll do it later"
5. **Verify**: Navigates to main tabs
6. **Verify**: Sign-up page does NOT reappear on subsequent launches

#### Test 2: Settings Banner (Anonymous)

1. Open Settings as an anonymous user
2. **Verify**: Green gradient banner is visible at the top
3. Tap "Sign Up" button
4. **Verify**: Navigates to sign-up screen

#### Test 3: Google OAuth Conversion

1. From any sign-up surface, tap "Continue with Google"
2. Complete Google sign-in in the browser
3. **Verify**: Success toast appears ("Account secured ✓")
4. **Verify**: Navigates to main tabs
5. **Verify**: Settings no longer shows the sign-up banner
6. **Verify**: All existing transactions and accounts are still present

#### Test 4: Urgency Prompt (requires 50+ transactions)

1. As an anonymous user, create 50+ transactions
2. Force-close and relaunch the app
3. **Verify**: Urgency bottom sheet appears with correct stats
4. Tap "Skip for now"
5. **Verify**: Bottom sheet dismissed
6. **Verify**: Does NOT reappear on next launch (within cooldown)
7. Add 50 more transactions
8. Relaunch the app
9. **Verify**: Bottom sheet reappears

#### Test 5: Permanent Dismiss

1. Trigger urgency prompt (50+ transactions)
2. Tap "Never show this again"
3. Add 100+ more transactions and relaunch
4. **Verify**: Bottom sheet NEVER appears again

#### Test 6: Platform-Specific Buttons

1. On Android: **Verify** exactly 2 buttons (Google, Facebook)
2. On iOS: **Verify** exactly 3 buttons (Google, Facebook, Apple)

---

## Complexity Tracking

No constitution violations. No complexity justifications needed.
