# Implementation Plan: Remove Anonymous User Flow and Enforce Authentication

**Branch**: `016-remove-anonymous-auth` | **Date**: 2026-03-09 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/specs/016-remove-anonymous-auth/spec.md`

## Summary

Remove the anonymous/guest authentication flow and enforce mandatory
sign-up/sign-in before app access. This involves: (1) removing
`signInAnonymously()` and `ensureAuthenticated()` anonymous fallback, (2)
replacing `linkIdentity` OAuth with direct `signInWithOAuth`, (3) adding
email/password auth with email verification, (4) adding forgot-password flow,
(5) converting `sign-up.tsx` to unified `auth.tsx` screen, (6) removing all
anonymous-specific UI (signup prompt, Settings banner, skip buttons), (7)
simplifying `AuthContext` by removing `isAnonymous` and `resolveUser`.

## Technical Context

**Language/Version**: TypeScript (strict mode) across all packages **Primary
Dependencies**: React Native + Expo (managed), Supabase Auth, WatermelonDB,
NativeWind v4, Expo Router **Storage**: Supabase (PostgreSQL + Auth),
WatermelonDB (local SQLite), AsyncStorage **Testing**: Jest + React Native
Testing Library **Target Platform**: iOS + Android (Expo managed workflow)
**Project Type**: Mobile + API monorepo (npm workspaces + Nx) **Constraints**:
Offline-first (WatermelonDB), Egyptian market focus, NativeWind shadow bug

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                     | Status  | Notes                                                                                             |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| I. Offline-First Data         | ✅ PASS | Auth is inherently online, but app routing ensures auth check happens once. No data path changes. |
| II. Documented Business Logic | ✅ PASS | Anonymous auth removal must be documented in `business-decisions.md` after implementation.        |
| III. Type Safety              | ✅ PASS | All new code will use strict TypeScript, no `any`, explicit return types.                         |
| IV. Service-Layer Separation  | ✅ PASS | Auth logic stays in `services/`, hooks handle lifecycle, components render UI.                    |
| V. Premium UI                 | ✅ PASS | Auth screen will follow Egyptian-inspired palette, dark mode, premium aesthetic.                  |
| VI. Monorepo Boundaries       | ✅ PASS | All changes are within `apps/mobile/`. No package boundary violations.                            |
| VII. Local-First Migrations   | ✅ PASS | No DB schema changes needed; RLS policies already enforce `authenticated` role.                   |

## Project Structure

### Documentation (this feature)

```text
specs/016-remove-anonymous-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── spec.md              # Feature specification
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (affected files)

```text
apps/mobile/
├── app/
│   ├── index.tsx                    # [MODIFY] Remove ensureAuthenticated, add auth check routing
│   ├── auth.tsx                     # [NEW] Unified authentication screen (replaces sign-up.tsx)
│   ├── sign-up.tsx                  # [DELETE] Replaced by auth.tsx
│   ├── onboarding.tsx               # [MODIFY] Remove isAnonymous routing, always go to tabs
│   ├── settings.tsx                 # [MODIFY] Remove isAnonymous conditionals, sign-up banner
│   ├── _layout.tsx                  # [MODIFY] Replace sign-up route with auth route
│   └── auth-callback.tsx            # [MODIFY] Handle email verification deep links
├── context/
│   └── AuthContext.tsx              # [MODIFY] Remove isAnonymous, resolveUser, simplify state
├── services/
│   ├── supabase.ts                  # [MODIFY] Remove signInAnonymously, ensureAuthenticated,
│   │                                #          linkIdentityWithProvider. Add signUpWithEmail,
│   │                                #          signInWithEmail, resetPassword
│   ├── auth-service.ts              # [MODIFY] Remove initiateOAuthLink, add signInWithOAuth
│   │                                #          (simplified), add email auth functions
│   ├── logout-service.ts            # [MODIFY] Remove signInAnonymously after logout
│   ├── signup-prompt-service.ts     # [DELETE] Entire file removed
│   └── index.ts                     # [MODIFY] Remove signInAnonymously export
├── hooks/
│   ├── useOAuthFlow.ts              # [MODIFY] Simplify — remove conflict detection, use
│   │                                #          direct signInWithOAuth instead of linkIdentity
│   ├── useOAuthLink.ts              # [DELETE] Only used for anonymous-to-linked flow
│   └── useSignUpPrompt.ts           # [DELETE] Entire file removed
├── components/
│   ├── sign-up/
│   │   └── SocialLoginButtons.tsx   # [MODIFY] Move to components/auth/, update for auth screen
│   ├── auth/                        # [NEW] Directory for auth-related components
│   │   ├── SocialLoginButtons.tsx   # [MOVED] From sign-up/ (mostly unchanged)
│   │   └── EmailPasswordForm.tsx    # [NEW] Email/password sign-up/sign-in form
│   ├── navigation/
│   │   └── AppDrawer.tsx            # [MODIFY] Remove isAnonymous conditional
│   └── modals/
│       └── SignUpPromptSheet.tsx     # [DELETE] If exists — signup prompt bottom sheet
├── constants/
│   ├── storage-keys.ts              # [MODIFY] Remove signup-prompt-* keys
│   └── auth-constants.ts            # [MODIFY] Update if needed
└── __tests__/
    ├── services/
    │   ├── auth-service.test.ts     # [MODIFY] Remove linkIdentity tests, add OAuth/email tests
    │   └── logout-service.test.ts   # [MODIFY] Remove signInAnonymously assertions
    └── hooks/
        ├── useOAuthFlow.test.ts     # [MODIFY] Update for simplified OAuth flow
        └── useSignUpPrompt.test.ts  # [DELETE] Entire file removed
```

## Proposed Changes

### Phase 1: Core Auth Infrastructure (Foundation)

Changes that all other phases depend on. These modify the auth primitives.

---

#### [MODIFY] `services/supabase.ts`

**Remove:**

- `signInAnonymously()` function (lines ~184-191)
- `ensureAuthenticated()` function (lines ~200-225) — this is the anonymous
  session bootstrap
- `linkIdentityWithProvider()` function (lines ~245+)

**Add:**

- `signUpWithEmail(email: string, password: string): Promise<AuthResult>` —
  calls `supabase.auth.signUp({ email, password })`
- `signInWithEmail(email: string, password: string): Promise<AuthResult>` —
  calls `supabase.auth.signInWithPassword({ email, password })`
- `resetPasswordForEmail(email: string): Promise<AuthResult>` — calls
  `supabase.auth.resetPasswordForEmail(email)`
- `resendVerificationEmail(email: string): Promise<AuthResult>` — calls
  `supabase.auth.resend({ type: 'signup', email })`

**Keep:**

- `signInWithOAuthProvider()` — already exists and works for direct OAuth
  sign-in
- `isAuthenticated()` — still needed for session checks
- `getCurrentUserId()` — still needed throughout the app
- `supabase` client instance

---

#### [MODIFY] `services/auth-service.ts`

**Remove:**

- `initiateOAuthLink()` function — the entire identity-linking flow
- `validateLinkIdentityResponse()` helper
- `linkIdentityWithProvider` import
- All references to `linkIdentity`, identity conflict detection

**Add:**

- `signInWithOAuth(provider: OAuthProvider): Promise<OAuthResult>` — simplified
  function that calls `signInWithOAuthProvider()` and opens browser (no identity
  linking, no conflict detection)
- `signUpWithEmail(email: string, password: string): Promise<EmailAuthResult>` —
  wraps `supabase.ts` call with error formatting
- `signInWithEmail(email: string, password: string): Promise<EmailAuthResult>` —
  wraps `supabase.ts` call with error formatting
- `requestPasswordReset(email: string): Promise<void>` — wraps
  `resetPasswordForEmail()`

**Keep:**

- `signInWithExistingAccount()` — rename to just use `signInWithOAuth` directly
- Browser session handling utilities

---

#### [MODIFY] `services/logout-service.ts`

**Change:** Remove `await supabase.auth.signInAnonymously()` call after sign-out
(line ~211). After logout, the session should simply be null — no anonymous
fallback.

---

#### [MODIFY] `services/index.ts`

**Remove:** `signInAnonymously` from the export list.

---

#### [MODIFY] `context/AuthContext.tsx`

**Remove:**

- `isAnonymous` from the `AuthContextValue` interface and `value` object
- `resolveUser()` function entirely — no more anonymous-specific server-side
  verification
- All `console.log` debug statements related to `resolveUser`

**Simplify:**

- `onAuthStateChange` handler: remove the `TOKEN_REFRESHED` special-case that
  skipped `resolveUser`. Since `resolveUser` is removed, the handler just trusts
  the session user directly.
- Bootstrap: `getSession()` → if session exists and user is not `is_anonymous`,
  set user. If no session or user is anonymous, set user to null
  (unauthenticated).

**Add:**

- Expose `isAuthenticated: boolean` (true when `user !== null`) — replaces
  `isAnonymous` with inverted logic

---

### Phase 2: Routing & Entry Point

Changes to app navigation that enforce authentication before access.

---

#### [MODIFY] `app/index.tsx`

**Remove:**

- `ensureAuthenticated()` import and call — no more anonymous session bootstrap
- The entire `initializeApp` function

**Replace with:**

- Check `supabase.auth.getSession()` — if valid non-anonymous session exists,
  check onboarding status and redirect to `/(tabs)` or `/onboarding`
- If no valid session → redirect to `/auth` (the new authentication screen)
- Keep the loading spinner while performing the session check

---

#### [MODIFY] `app/_layout.tsx`

**Change:**

- Replace `<Stack.Screen name="sign-up" />` with `<Stack.Screen name="auth" />`

---

#### [MODIFY] `app/onboarding.tsx`

**Remove:**

- `isAnonymous` usage from `useAuth()` (line ~124)
- The `navigateAfterOnboarding` function's `isAnonymous` check (lines ~134-142)
  — after onboarding, always navigate to `/(tabs)` since user is already
  authenticated
- `pendingNavigationRef` logic tied to `isAnonymous`

**Simplify:**

- `handleCurrencyPickerSkip` and `handleGoToApp` just navigate to `/(tabs)`
  directly

---

### Phase 3: Unified Authentication Screen

The new `auth.tsx` screen that replaces `sign-up.tsx`.

---

#### [NEW] `app/auth.tsx`

The unified authentication screen. Design requirements:

- Welcoming header: "Welcome to Astik"
- Google OAuth button (using existing `SocialLoginButtons` component)
- Email/password form with Sign Up / Sign In toggle
- "Forgot Password?" link (visible in Sign In mode)
- Email verification pending state (shown after signup)
- Follows Egyptian-inspired palette, dark mode, premium aesthetic
- No "Skip" or "Continue as Guest" option

**States:**

1. **Default**: Shows OAuth buttons + email form (Sign Up mode)
2. **Sign In mode**: Email form shows password field + "Forgot Password?" link
3. **Loading**: Provider button shows spinner during OAuth/email auth
4. **Email verification pending**: After email signup, shows "Check your inbox"
   message with "Resend" button
5. **Forgot Password**: Email input + "Send Reset Link" button
6. **Error**: Toast or inline error messages for failed auth attempts

---

#### [NEW] `components/auth/EmailPasswordForm.tsx`

Email/password form component:

- Email input with validation
- Password input with show/hide toggle
- Mode toggle: "Sign Up" / "Sign In"
- Submit button with loading state
- "Forgot Password?" link (Sign In mode only)
- Inline error messages

---

#### [MOVED] `components/sign-up/SocialLoginButtons.tsx` → `components/auth/SocialLoginButtons.tsx`

Mostly unchanged — this component is already well-structured. Changes:

- Move to `components/auth/` directory
- Filter to only show Google (per scope decision — Facebook/Apple deferred)
- Update any import paths in consumers

---

#### [DELETE] `app/sign-up.tsx`

Fully replaced by `auth.tsx`. All functionality (OAuth, navigation guards) moves
to `auth.tsx`.

---

### Phase 4: Remove Anonymous UI & Dead Code

Clean up all UI elements and code that reference anonymous/guest state.

---

#### [MODIFY] `app/settings.tsx`

**Remove:**

- `isAnonymous` from `useAuth()` destructuring (line ~48)
- Sign-up banner conditional block (`{isAnonymous && (...)}`, line ~193)
- Conditional rendering based on `isAnonymous` for user email/logout (lines
  ~426, ~461)
- The Settings page should always show user info and logout for authenticated
  users

---

#### [MODIFY] `components/navigation/AppDrawer.tsx`

**Remove:**

- `isAnonymous` from `useAuth()` destructuring (line ~122)
- Conditional that hides items for anonymous users (`{!isAnonymous && (...)}`,
  line ~284)

---

#### [DELETE] `services/signup-prompt-service.ts`

Entire file removed — the usage-based prompt system is dead code.

---

#### [DELETE] `hooks/useSignUpPrompt.ts`

Entire file removed — the React hook wrapper around the prompt service.

---

#### [DELETE] `hooks/useOAuthLink.ts`

Entire file removed — only used for anonymous-to-linked identity flow.

---

#### [MODIFY] `constants/storage-keys.ts`

**Remove:**

- `SIGNUP_PROMPT_DISMISSED_AT_KEY` (line ~22)
- `SIGNUP_PROMPT_DISMISSED_TX_COUNT_KEY` (line ~26)
- `SIGNUP_PROMPT_NEVER_SHOW_KEY` (line ~29)

---

### Phase 5: Simplify OAuth Hook

---

#### [MODIFY] `hooks/useOAuthFlow.ts`

**Remove:**

- `initiateOAuthLink` import and usage — no more identity linking
- `conflictState` — no more identity conflict detection
- `confirmConflict` / `cancelConflict` — no conflict resolution needed
- `signInWithExistingAccount` flow — no longer a separate path from OAuth

**Simplify to:**

- Single `handleOAuth(provider)` function that calls the simplified
  `signInWithOAuth(provider)` from `auth-service.ts`
- Returns `{ loadingProvider, handleOAuth }` — much simpler interface
- Success/error callbacks remain

---

### Phase 6: Auth Callback & Deep Links

---

#### [MODIFY] `app/auth-callback.tsx`

**Add handling for:**

- Email verification callback (user clicks verification link in email)
- Password reset callback (user clicks reset link in email)
- Existing OAuth callback handling remains

---

### Phase 7: Test Updates

---

#### [MODIFY] `__tests__/services/auth-service.test.ts`

**Remove:**

- All `initiateOAuthLink` test suites
- `linkIdentityWithProvider` mocks
- Identity conflict tests

**Add:**

- Tests for simplified `signInWithOAuth`
- Tests for `signUpWithEmail` / `signInWithEmail`
- Tests for `requestPasswordReset`

---

#### [MODIFY] `__tests__/services/logout-service.test.ts`

**Remove:**

- `signInAnonymously` mock setup and assertions
- Tests verifying anonymous session creation after logout

**Update:**

- Tests should verify session is fully cleared with no fallback

---

#### [MODIFY] `__tests__/hooks/useOAuthFlow.test.ts`

**Update:**

- Remove `initiateOAuthLink` mocks
- Remove conflict state tests
- Test simplified `handleOAuth` flow

---

#### [DELETE] `__tests__/hooks/useSignUpPrompt.test.ts`

Entire file removed with the hook.

---

## Verification Plan

### Automated Tests

```bash
# Run all auth-related unit tests
npx nx test mobile -- --testPathPattern="auth-service|logout-service|useOAuthFlow"

# Run full test suite to catch regressions
npx nx test mobile

# TypeScript compilation check
npx nx run mobile:typecheck

# Verify no signInAnonymously references remain
grep -r "signInAnonymously" apps/mobile/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__
```

### Manual Verification

1. **Fresh install**: App shows auth screen (not dashboard). No skip option.
2. **Google OAuth sign-up**: Successfully creates account, proceeds to
   onboarding, then dashboard.
3. **Google OAuth sign-in**: Returning user goes directly to dashboard.
4. **Email/password sign-up**: Receives verification email, cannot access app
   until verified.
5. **Email/password sign-in**: After verification, can sign in with credentials.
6. **Forgot Password**: Reset email sent, link works, can set new password.
7. **Logout**: Fully clears session, returns to auth screen. Reopen shows auth
   screen.
8. **Session persistence**: Sign in, force-close, reopen → dashboard (not auth
   screen).
9. **Settings**: No sign-up banner visible for authenticated users.
10. **Onboarding**: No "Skip" or "Continue as Guest" option.

### RLS Policy Verification

> **Note**: Supabase MCP access was unavailable during planning. RLS policies
> should be verified manually via the Supabase dashboard during implementation
> to confirm they enforce `authenticated` role correctly without modification.

## Complexity Tracking

No constitution violations to justify.

## Implementation Order (Dependencies)

```
Phase 1 (Core Auth Infrastructure) ──→ all other phases depend on this
    ↓
Phase 2 (Routing) ──→ requires simplified AuthContext
    ↓
Phase 3 (Auth Screen) ──→ requires new email auth functions from Phase 1
    ↓
Phase 4 (Remove UI) ──→ can proceed in parallel with Phase 3
    ↓
Phase 5 (Simplify Hook) ──→ requires auth-service changes from Phase 1
    ↓
Phase 6 (Callbacks) ──→ requires email auth from Phase 1
    ↓
Phase 7 (Tests) ──→ after all code changes
```
