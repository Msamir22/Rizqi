# Profile Sync Root Cause Hardening Plan

## Goal

Fix the profile-routing and local data isolation issue from the root causes:
local reads must be scoped to the authenticated user, sync must fail loudly on
pull/push errors, and private runtime providers must not mount before auth is
resolved.

## Scope

- Route authenticated users through a private Expo Router group guarded by auth.
- Keep WatermelonDB as the source of truth for user-facing data.
- Preserve local rows across logout, but ensure every local read/write is scoped
  to the current authenticated user.
- Replace the blocking sync overlay with the account startup loading surface.
- Harden sync push/pull error behavior so failed syncs do not advance
  WatermelonDB metadata as if they succeeded.
- Add lint guardrails that push developers toward scoped helper APIs.

## Non-Goals

- Do not add remote profile bootstrap or direct remote-profile local patching in
  this branch.
- Do not clear local user data on logout.
- Do not migrate the custom ESLint rule to a package/plugin yet; that remains a
  follow-up because the current project uses ESLint 8 `--rulesdir`.

## Verification

- TypeScript compile for the mobile app.
- Focused Jest coverage for profile routing, private route gating, sync failure
  semantics, child-table sync scoping, foreign-row financial write rejection,
  user-scoped data helpers, and startup loading animation math.
- Targeted ESLint with the local scoped-access rule enabled.
