# Tasks: Remove Anonymous User Flow and Enforce Authentication

**Input**: Design documents from `/specs/016-remove-anonymous-auth/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**Tests**: Not explicitly requested — test tasks are limited to updating
existing test files (cleanup of dead tests + adding coverage for new functions).

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Mobile app**: `apps/mobile/`
- **Services**: `apps/mobile/services/`
- **Hooks**: `apps/mobile/hooks/`
- **Components**: `apps/mobile/components/`
- **Screens**: `apps/mobile/app/`
- **Tests**: `apps/mobile/__tests__/`

---

## Phase 1: Setup

**Purpose**: No new project initialization needed — this is a refactor within
the existing monorepo. Setup covers creating the new `components/auth/`
directory and moving reusable components.

- [ ] T001 Create `apps/mobile/components/auth/` directory and move
      `apps/mobile/components/sign-up/SocialLoginButtons.tsx` to
      `apps/mobile/components/auth/SocialLoginButtons.tsx`
- [ ] T002 Update all import paths referencing
      `@/components/sign-up/SocialLoginButtons` to
      `@/components/auth/SocialLoginButtons` across the codebase

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth infrastructure changes that all user stories depend on.
These modify the auth primitives.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Remove `signInAnonymously()` function from
      `apps/mobile/services/supabase.ts`
- [ ] T004 Remove `ensureAuthenticated()` function from
      `apps/mobile/services/supabase.ts`
- [ ] T005 Remove `linkIdentityWithProvider()` function from
      `apps/mobile/services/supabase.ts`
- [ ] T006 [P] Add `signUpWithEmail(email, password)` function to
      `apps/mobile/services/supabase.ts` — wraps
      `supabase.auth.signUp({ email, password })`
- [ ] T007 [P] Add `signInWithEmail(email, password)` function to
      `apps/mobile/services/supabase.ts` — wraps
      `supabase.auth.signInWithPassword({ email, password })`
- [ ] T008 [P] Add `resetPasswordForEmail(email)` function to
      `apps/mobile/services/supabase.ts` — wraps
      `supabase.auth.resetPasswordForEmail(email)`
- [ ] T009 [P] Add `resendVerificationEmail(email)` function to
      `apps/mobile/services/supabase.ts` — wraps
      `supabase.auth.resend({ type: 'signup', email })`
- [ ] T010 Remove `signInAnonymously` from the exports in
      `apps/mobile/services/index.ts`
- [ ] T011 Remove `initiateOAuthLink()`, `validateLinkIdentityResponse()`, and
      `signInWithExistingAccount()` from `apps/mobile/services/auth-service.ts`
      — remove all identity-linking and legacy sign-in logic (the new
      `signInWithOAuth` in T012 replaces `signInWithExistingAccount`)
- [ ] T012 Add simplified `signInWithOAuth(provider)` function to
      `apps/mobile/services/auth-service.ts` — calls
      `signInWithOAuthProvider()` + opens browser (no linking, no conflict
      detection)
- [ ] T013 [P] Add `signUpWithEmail(email, password)` wrapper to
      `apps/mobile/services/auth-service.ts` — wraps supabase call with error
      formatting
- [ ] T014 [P] Add `signInWithEmail(email, password)` wrapper to
      `apps/mobile/services/auth-service.ts` — wraps supabase call with error
      formatting
- [ ] T015 [P] Add `requestPasswordReset(email)` function to
      `apps/mobile/services/auth-service.ts` — wraps `resetPasswordForEmail()`
- [ ] T016 Remove `isAnonymous` from the `AuthContextValue` interface and value
      object in `apps/mobile/context/AuthContext.tsx`
- [ ] T017 Remove `resolveUser()` function and all its debug logging from
      `apps/mobile/context/AuthContext.tsx`
- [ ] T018 Add `isAuthenticated: boolean` (derived from `user !== null`) to
      `AuthContextValue` in `apps/mobile/context/AuthContext.tsx`
- [ ] T019 Simplify `onAuthStateChange` handler in
      `apps/mobile/context/AuthContext.tsx` — remove TOKEN_REFRESHED
      special-case and resolveUser calls, trust session user directly
- [ ] T020 Simplify bootstrap in `apps/mobile/context/AuthContext.tsx` — if
      session exists and user is not `is_anonymous`, set user; if no session or
      anonymous, set user to null

**Checkpoint**: Foundation ready — auth primitives are updated.
`signInAnonymously`, `linkIdentity`, `resolveUser`, and `isAnonymous` are gone.
Email auth and simplified OAuth are available. User story implementation can now
begin.

---

## Phase 3: User Story 1 — New User Must Authenticate Before Using the App (Priority: P1) 🎯 MVP

**Goal**: First-time users see the Authentication screen and must sign up via
Google OAuth or email/password. No skip option.

**Independent Test**: Install app fresh → Authentication screen appears → only
sign-up/sign-in options → no "Skip" or "Continue as Guest"

### Implementation for User Story 1

- [ ] T021 [US1] Replace `ensureAuthenticated()` call in
      `apps/mobile/app/index.tsx` with session check via
      `supabase.auth.getSession()` — redirect to `/auth` if no valid
      non-anonymous session, otherwise check onboarding and redirect to
      `/(tabs)` or `/onboarding`
- [ ] T022 [US1] Replace `<Stack.Screen name="sign-up" />` with
      `<Stack.Screen name="auth" />` in `apps/mobile/app/_layout.tsx`
- [ ] T023 [US1] Create `apps/mobile/components/auth/EmailPasswordForm.tsx` —
      email input with validation, password input with show/hide toggle, mode
      toggle (Sign Up / Sign In), submit button with loading state, "Forgot
      Password?" link (Sign In mode only), inline error messages
- [ ] T024 [US1] Create `apps/mobile/app/auth.tsx` — unified Authentication
      screen with: welcoming header ("Welcome to Astik"), Google OAuth button
      (via `SocialLoginButtons`), email/password form (via `EmailPasswordForm`),
      email verification pending state, forgot-password flow, no "Skip" option.
      Filter `SocialLoginButtons` to Google-only. Must handle network errors
      with a clear error message and retry option (spec edge case).
- [ ] T025 [US1] Add email verification pending state handling to
      `apps/mobile/app/auth.tsx` — after email signup, show "Check your inbox"
      message with "Resend" button calling `resendVerificationEmail()`
- [ ] T026 [US1] Add forgot-password flow to `apps/mobile/app/auth.tsx` — email
      input + "Send Reset Link" button calling `requestPasswordReset()`, shows
      confirmation message
- [ ] T027 [US1] Update `apps/mobile/app/auth-callback.tsx` to handle email
      verification deep links — detect verification callback type, complete
      email confirmation, route to onboarding or dashboard
- [ ] T028 [US1] Update `apps/mobile/app/auth-callback.tsx` to handle password
      reset deep links — detect reset callback, present password update UI or
      route appropriately
- [ ] T029 [US1] Delete `apps/mobile/app/sign-up.tsx`

**Checkpoint**: New users see the Authentication screen. Google OAuth and
email/password sign-up work. Email verification is enforced. Forgot Password
flow works. No skip option exists.

---

## Phase 4: User Story 2 — Returning User Signs In Directly (Priority: P1)

**Goal**: Returning users with valid sessions go straight to dashboard. Expired
sessions see Auth screen and can sign in.

**Independent Test**: Sign in → force-close → reopen → dashboard appears
(session persists). Sign out → reopen → Auth screen appears.

### Implementation for User Story 2

- [ ] T030 [US2] Simplify `useOAuthFlow` hook in
      `apps/mobile/hooks/useOAuthFlow.ts` — remove `initiateOAuthLink` usage,
      remove `conflictState`/`confirmConflict`/`cancelConflict`, use simplified
      `signInWithOAuth()` from auth-service. Return
      `{ loadingProvider, handleOAuth }` only.
- [ ] T031 [US2] Verify session persistence in `apps/mobile/app/index.tsx` —
      ensure `getSession()` correctly restores valid sessions on app reopen,
      skipping the auth screen
- [ ] T032 [US2] Delete `apps/mobile/hooks/useOAuthLink.ts` — only used for
      anonymous-to-linked identity flow, now dead code

**Checkpoint**: Returning users with valid sessions bypass Auth screen. Expired
sessions route to Auth. OAuth sign-in works for returning users.

---

## Phase 5: User Story 3 — User Logs Out and Session Is Fully Cleared (Priority: P2)

**Goal**: Logout clears the session entirely (no anonymous fallback). User
returns to Auth screen.

**Independent Test**: Sign in → Settings → Log Out → Auth screen appears →
reopen app → Auth screen appears.

### Implementation for User Story 3

- [ ] T033 [US3] Remove `await supabase.auth.signInAnonymously()` call after
      sign-out in `apps/mobile/services/logout-service.ts` — session should
      become null after logout
- [ ] T034 [US3] Verify that `apps/mobile/app/index.tsx` correctly routes to
      `/auth` when session is null (already handled by T021, but verify).

**Checkpoint**: Logout fully clears the session. No anonymous fallback. App
returns to Auth screen.

---

## Phase 6: User Story 4 — Sign-Up Prompts and Anonymous-Specific UI Are Removed (Priority: P2)

**Goal**: Remove all UI elements designed for anonymous/guest users. Clean up
dead code.

**Independent Test**: Navigate through all screens → no guest-mode UI appears
(no sign-up banner, no prompt sheet, no conditional rendering based on
`isAnonymous`).

### Implementation for User Story 4

- [ ] T035 [P] [US4] Remove `isAnonymous` destructuring, sign-up banner
      (`{isAnonymous && (...)}` block), and conditional profile/logout rendering
      from `apps/mobile/app/settings.tsx`
- [ ] T036 [P] [US4] Remove `isAnonymous` destructuring and conditional
      rendering (`{!isAnonymous && (...)}`) from
      `apps/mobile/components/navigation/AppDrawer.tsx`
- [ ] T037 [P] [US4] Remove `isAnonymous` routing logic from
      `apps/mobile/app/onboarding.tsx` — after onboarding always navigate to
      `/(tabs)`, remove `navigateAfterOnboarding` isAnonymous check, remove
      `pendingNavigationRef` logic
- [ ] T038 [P] [US4] Delete `apps/mobile/services/signup-prompt-service.ts`
- [ ] T039 [P] [US4] Delete `apps/mobile/hooks/useSignUpPrompt.ts`
- [ ] T040 [P] [US4] Remove signup-prompt storage keys
      (`SIGNUP_PROMPT_DISMISSED_AT_KEY`, `SIGNUP_PROMPT_DISMISSED_TX_COUNT_KEY`,
      `SIGNUP_PROMPT_NEVER_SHOW_KEY`) from
      `apps/mobile/constants/storage-keys.ts`
- [ ] T041 [US4] Remove old `apps/mobile/components/sign-up/` directory (after
      confirming SocialLoginButtons was moved in T001)

**Checkpoint**: All anonymous-specific UI is removed. No `isAnonymous`
references remain in UI code. Dead code cleaned up.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Test updates, documentation, and final validation

- [ ] T042 [P] Remove `signInAnonymously` mock setup, assertions, and anonymous
      test cases from `apps/mobile/__tests__/services/logout-service.test.ts`
- [ ] T043 [P] Remove `initiateOAuthLink` and `linkIdentityWithProvider` test
      suites from `apps/mobile/__tests__/services/auth-service.test.ts`
- [ ] T044 [P] Add test cases for simplified `signInWithOAuth` in
      `apps/mobile/__tests__/services/auth-service.test.ts`
- [ ] T045 [P] Add test cases for `signUpWithEmail` and `signInWithEmail` in
      `apps/mobile/__tests__/services/auth-service.test.ts`
- [ ] T046 [P] Add test case for `requestPasswordReset` in
      `apps/mobile/__tests__/services/auth-service.test.ts`
- [ ] T047 Update `apps/mobile/__tests__/hooks/useOAuthFlow.test.ts` — remove
      conflict state tests, test simplified handleOAuth flow
- [ ] T048 Delete `apps/mobile/__tests__/hooks/useSignUpPrompt.test.ts`
- [ ] T049 Run `npx nx run mobile:typecheck` to verify TypeScript compilation
      passes
- [ ] T050 Run `npx nx test mobile` to verify all unit tests pass
- [ ] T051 Run
      `grep -r "signInAnonymously\|isAnonymous\|initiateOAuthLink\|linkIdentity\|useSignUpPrompt\|useOAuthLink" apps/mobile/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__`
      to verify no dead references remain in production code
- [ ] T052 Update `docs/business/business-decisions.md` to document the removal
      of anonymous auth and enforcement of mandatory sign-in

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user
  stories
- **US1 (Phase 3)**: Depends on Phase 2 — core MVP, must complete first
- **US2 (Phase 4)**: Depends on Phase 2 + T024 (auth.tsx created) — mostly
  verification
- **US3 (Phase 5)**: Depends on Phase 2 — independent of US1/US2
- **US4 (Phase 6)**: Depends on Phase 2 — independent, all tasks parallelizable
- **Polish (Phase 7)**: Depends on Phases 3-6 completion

### User Story Dependencies

- **US1 (P1)**: Must complete first — creates `auth.tsx` and email auth
  functions
- **US2 (P1)**: Depends on `auth.tsx` from US1 for the sign-in path; simplifies
  OAuth hook
- **US3 (P2)**: Independent — only touches `logout-service.ts`
- **US4 (P2)**: Independent — only removes dead code. All tasks parallelizable
  with [P]

### Parallel Opportunities

- T006-T009 (supabase.ts new functions) can run in parallel
- T013-T015 (auth-service.ts new functions) can run in parallel
- T035-T041 (US4 dead code cleanup) can ALL run in parallel
- T042-T048 (test updates) can all run in parallel
- US3 and US4 can execute in parallel with each other

---

## Parallel Example: User Story 4

```bash
# All US4 tasks can run in parallel (different files, no dependencies):
T035: Remove isAnonymous from settings.tsx
T036: Remove isAnonymous from AppDrawer.tsx
T037: Remove isAnonymous routing from onboarding.tsx
T038: Delete signup-prompt-service.ts
T039: Delete useSignUpPrompt.ts
T040: Remove storage keys from storage-keys.ts
T041: Remove old sign-up/ directory
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T020) — **CRITICAL, blocks everything**
3. Complete Phase 3: User Story 1 (T021-T029)
4. **STOP and VALIDATE**: Install fresh → Auth screen → sign up works → no skip

### Incremental Delivery

1. Setup + Foundational → Auth primitives ready
2. Add US1 → Auth screen works → **MVP** ✓
3. Add US2 → Returning users handled → Test session persistence
4. Add US3 → Logout works correctly → No anonymous fallback
5. Add US4 → Dead code cleaned up → No guest UI remnants
6. Polish → Tests pass, TypeScript compiles, no dead references

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently
- **Total tasks: 52** (2 setup + 18 foundational + 9 US1 + 3 US2 + 2 US3 + 7
  US4 + 11 polish)
