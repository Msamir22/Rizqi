-- Feature: 024-skip-returning-onboarding
-- Refines the state introduced by migration 040 after the spec was simplified
-- (2026-04-18). See specs/024-skip-returning-onboarding/data-model.md.
--
-- What migration 040 did:
--   * ADD COLUMN profiles.preferred_language TEXT NULL
--   * ADD COLUMN profiles.slides_viewed BOOLEAN NOT NULL DEFAULT FALSE
--
-- What we now want (per the simplified design):
--   * profiles.preferred_language should be a Postgres enum
--     `preferred_language_code` ('en' | 'ar'), NOT NULL, DEFAULT 'en'.
--     Rationale: enum enforces values at the DB layer, feeds a clean
--     PreferredLanguageCode union into the generated TS types, and removes
--     the nullable/"what if it's NULL" ambiguity in the router.
--   * profiles.slides_viewed is removed. Per-step onboarding progress
--     (including "slides viewed/skipped") lives in AsyncStorage keyed by
--     userId, not the DB, per spec FR-008.
--
-- Transition steps:
--   1. Drop the now-obsolete slides_viewed column.
--   2. Drop the old nullable TEXT preferred_language column.
--   3. Create the preferred_language_code enum (lowercase values to match
--      the existing apps/mobile/i18n codebase).
--   4. Re-add preferred_language as the enum type, NOT NULL DEFAULT 'en'.
--      Any row that lost a non-default value in step 2 picks up 'en'. Given
--      the app is pre-production and no user-facing data depended on the
--      nullable column, this is acceptable.

ALTER TABLE profiles DROP COLUMN IF EXISTS slides_viewed;

ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_language;

CREATE TYPE preferred_language_code AS ENUM ('en', 'ar');

ALTER TABLE profiles
  ADD COLUMN preferred_language preferred_language_code NOT NULL DEFAULT 'en';
