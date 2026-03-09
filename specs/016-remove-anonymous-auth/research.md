# Research: Remove Anonymous User Flow and Enforce Authentication

**Generated**: 2026-03-09 **Feature Branch**: `016-remove-anonymous-auth`

## 1. Anonymous Auth Removal

**Decision**: Remove all `signInAnonymously()` calls and the
`ensureAuthenticated()` bootstrap function.

**Rationale**: Anonymous sessions are the root cause of the complexity in the
auth flow (identity linking, conflict detection, `resolveUser` server
verification). Removing them simplifies the entire auth stack.

**Alternatives considered**:

- Keep anonymous auth but restrict features → rejected: still creates
  identity-linking complexity
- Soft-disable (return early in `signInAnonymously`) → rejected: leaves dead
  code paths

**Affected files**: `supabase.ts`, `logout-service.ts`, `index.ts`, `index.tsx`

## 2. OAuth Flow Simplification

**Decision**: Replace `linkIdentity` flow with direct `signInWithOAuth` for all
OAuth providers.

**Rationale**: `signInWithOAuthProvider()` already exists in `supabase.ts`
(line 272) and wraps `supabase.auth.signInWithOAuth()`. It's currently only used
by `signInWithExistingAccount()` in `auth-service.ts`. With anonymous auth gone,
this becomes the primary OAuth path — no linking needed.

**Alternatives considered**:

- Build a new OAuth wrapper → rejected: `signInWithOAuthProvider` already works
  correctly
- Keep `initiateOAuthLink` and modify it → rejected: identity linking concept is
  dead

**Key insight**: The existing `signInWithExistingAccount()` function
(auth-service.ts line ~347+) already implements the correct non-anonymous OAuth
flow. It should become the template for the simplified `signInWithOAuth()`.

## 3. Email/Password Authentication

**Decision**: Use Supabase's built-in email/password auth (`signUp`,
`signInWithPassword`, `resetPasswordForEmail`).

**Rationale**: Supabase handles email verification, password hashing, and reset
tokens natively. No need to build custom infrastructure.

**Key Supabase APIs**:

- `supabase.auth.signUp({ email, password })` — creates user, sends verification
  email
- `supabase.auth.signInWithPassword({ email, password })` — authenticates
  verified user
- `supabase.auth.resetPasswordForEmail(email)` — sends password reset email
- `supabase.auth.resend({ type: 'signup', email })` — resends verification email

**Email verification flow**:

1. User submits email + password on auth screen
2. Supabase creates user with `email_confirmed_at = null`
3. Verification email sent with magic link
4. User clicks link → `auth-callback.tsx` handles the deep link
5. Session is created, `onAuthStateChange` fires with `SIGNED_IN`

## 4. AuthContext Simplification

**Decision**: Remove `isAnonymous` and `resolveUser`, replace with simple
session-based state.

**Rationale**: `resolveUser()` exists solely to verify whether an anonymous
session has been upgraded server-side. Without anonymous sessions, we just trust
the session user directly.

**New state model**:

- `user: User | null` — null = unauthenticated
- `isLoading: boolean` — true during session hydration
- `isAuthenticated: boolean` — derived from `user !== null`

## 5. Routing Strategy

**Decision**: Use Expo Router redirects in `index.tsx` to gate access.

**Rationale**: The current `index.tsx` already handles routing logic (onboarding
check). We extend it with an auth session check:

1. Check session → no session → redirect to `/auth`
2. Has session → check onboarding → redirect to `/onboarding` or `/(tabs)`

**Alternative considered**: Expo Router route groups (`(auth)` vs `(app)`) →
rejected for now as it requires restructuring the entire route tree; the current
Stack-based approach is simpler for this change.

## 6. SocialLoginButtons Reuse

**Decision**: Move `SocialLoginButtons` from `components/sign-up/` to
`components/auth/`, filter to Google-only.

**Rationale**: The component is already well-structured (OCP-compliant,
presentational). Only needs directory move and provider filtering.
Facebook/Apple providers remain in the config but are either hidden or shown as
disabled.

## 7. RLS Policy Verification

**Decision**: Defer verification to implementation phase.

**Rationale**: Supabase MCP access returned "Forbidden resource" during
planning. The current assumption is that RLS policies already enforce
`authenticated` role, which will work correctly since we're only removing
anonymous auth (a subset of `authenticated`). Manual verification needed via
Supabase dashboard.
