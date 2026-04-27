-- Feature: 026-onboarding-restructure
-- Adds per-profile first-run tooltip dismissal markers as JSONB.
-- See specs/026-onboarding-restructure/contracts/onboarding-flags-schema.md
-- for the authoritative shape and semantic contract.

-- `IF NOT EXISTS` for repo-standard idempotency (matches the 100+ other
-- ADD COLUMN sites in this migrations folder). Without it, replaying
-- this migration on a partially-recovered database aborts the whole
-- batch with `column already exists`.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_flags JSONB NOT NULL DEFAULT '{}'::JSONB;

COMMENT ON COLUMN profiles.onboarding_flags
  IS 'Per-profile first-run tooltip dismissal markers. Boolean keys added '
     'without schema migrations. See spec 026-onboarding-restructure.';
