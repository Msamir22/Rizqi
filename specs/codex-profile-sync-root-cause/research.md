# Profile Sync Root Cause Research

## Findings

- The stale-profile symptom can be caused by unscoped local reads when preserved
  local rows from another debug account remain on device.
- Preserving local rows on logout is acceptable only if all user-owned reads and
  writes are scoped to the authenticated user and child rows are scoped through
  verified owned parents.
- WatermelonDB sync metadata is local app data; normal OS clear-storage or
  reinstall clears it, but debug/partial states still need defensive guards.
- Child tables such as `asset_metals` and `bank_details` inherit ownership from
  parent rows, so sync and local reads must include parent ownership checks.
- A private route group is the correct boundary for mounting private runtime
  providers, but hooks still need data-level guards for transitions, tests,
  account switches, and future reuse.

## Decisions

- Use current-user scoped helper APIs for local reads instead of relying on a
  route guard alone.
- Keep sync push/pull failures as hard failures so WatermelonDB does not mark
  dirty changes synced or treat missing remote data as an empty successful pull.
- Keep `--rulesdir` for the custom ESLint rule in this branch and track plugin
  migration separately before any ESLint 9 upgrade.
