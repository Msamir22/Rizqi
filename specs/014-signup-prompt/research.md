# Research: 014-signup-prompt

## R1: Supabase `linkIdentity()` for Anonymous-to-OAuth Conversion

**Decision**: Use Supabase's `linkIdentity({ provider })` to convert anonymous
users to OAuth-linked accounts.

**Rationale**: Supabase natively supports anonymous auth → permanent account
conversion. `linkIdentity()` preserves the existing `user_id`, meaning all data
in WatermelonDB and Supabase linked to that user_id remains intact. No data
migration is needed.

**Alternatives considered**:

- `updateUser({ email, password })` — only works for email/password, not OAuth.
- Create new user + migrate data — complex, error-prone, violates offline-first
  principle.

**Key API**:

```typescript
const { data, error } = await supabase.auth.linkIdentity({
  provider: "google" | "facebook" | "apple",
  options: { redirectTo: "your-scheme://auth-callback" },
});
```

**Important**: `linkIdentity()` returns a URL that must be opened in a browser
for the OAuth flow. After completion, Supabase fires an `onAuthStateChange`
event with the updated user. The `is_anonymous` flag on the user object becomes
`false` after successful linking.

---

## R2: OAuth Packages for Expo Managed Workflow

**Decision**: Use `expo-auth-session` + `expo-web-browser` for OAuth flows.

**Rationale**: These are the officially recommended packages for OAuth in Expo
managed workflow. They handle redirect URLs, PKCE, and browser sessions
natively.

**Alternatives considered**:

- `react-native-google-signin` — requires native config outside managed
  workflow.
- `expo-apple-authentication` — Apple-specific; only needed for the native Apple
  Sign-In button on iOS. May be used as a complement for a more native Apple
  experience, but `linkIdentity` with `expo-web-browser` handles Apple OAuth
  too.
- Facebook SDK (`react-native-fbsdk-next`) — heavy native dependency; not needed
  when Supabase handles OAuth via web flow.

**Packages to install**:

- `expo-auth-session` — OAuth session management
- `expo-web-browser` — opens system browser for OAuth
- `expo-crypto` — required peer dependency for `expo-auth-session`

---

## R3: Platform Detection for Conditional Apple Sign-In

**Decision**: Use React Native's `Platform.OS` to conditionally render Apple
Sign-In button only on iOS.

**Rationale**: Simple, built-in, no extra dependencies. Apple Sign-In is only
required on iOS (App Store policy).

**Code pattern**:

```typescript
import { Platform } from "react-native";

const SHOW_APPLE_SIGN_IN = Platform.OS === "ios";
```

---

## R4: AsyncStorage Keys for Prompt Dismissal

**Decision**: Use `@react-native-async-storage/async-storage` (already
installed) with `@astik/` prefix.

**Rationale**: Follows existing project conventions (e.g., `HAS_ONBOARDED_KEY`
in onboarding). AsyncStorage is already a dependency.

**Keys**:

```typescript
const SIGNUP_PROMPT_DISMISSED_AT = "@astik/signup-prompt-dismissed-at";
const SIGNUP_PROMPT_DISMISSED_TX_COUNT =
  "@astik/signup-prompt-dismissed-tx-count";
const SIGNUP_PROMPT_NEVER_SHOW = "@astik/signup-prompt-never-show";
```

---

## R5: Existing AuthContext Pattern

**Decision**: Extend existing `AuthContext` with `isAnonymous` derived property.

**Rationale**: `AuthContext` already provides `user`, `session`,
`isAuthenticated`, and `signOut`. Adding `isAnonymous` follows the same pattern
and requires minimal changes. The Supabase `User` object has an `is_anonymous`
field that can be read directly.

**Derivation**:

```typescript
const isAnonymous = user?.is_anonymous ?? false;
```

---

## R6: Onboarding Flow Integration Point

**Decision**: After wallet creation, instead of `router.replace('/(tabs)')`,
route to `sign-up` screen for anonymous users. The sign-up screen's skip action
then navigates to `/(tabs)`.

**Rationale**: The `handleGoToApp` callback in `onboarding.tsx` is the single
exit point from onboarding. Routing to sign-up before tabs is the
lowest-friction insertion point.

**Current flow**: Carousel → CurrencyPicker → WalletCreation → `/(tabs)` **New
flow**: Carousel → CurrencyPicker → WalletCreation → `/sign-up` → `/(tabs)`
