-- Feature: 024-skip-returning-onboarding
-- Adds preferred_language and slides_viewed to profiles for server-authoritative
-- onboarding routing. See specs/024-skip-returning-onboarding/data-model.md § 6.

ALTER TABLE profiles
  ADD COLUMN preferred_language TEXT NULL,
  ADD COLUMN slides_viewed BOOLEAN NOT NULL DEFAULT FALSE;

-- No index needed; no constraint needed (enum enforced at app layer).
-- RLS policies on profiles automatically cover the new columns.
