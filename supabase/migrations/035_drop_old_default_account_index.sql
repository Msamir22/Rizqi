-- =============================================================================
-- Migration 035: Drop Redundant Default Account Index
-- Feature: Edit Account & Delete Account (Issue #45)
-- =============================================================================
-- Migration 029 created idx_accounts_user_default with `deleted = false`.
-- Migration 033 replaced it with idx_accounts_one_default_per_user using
-- `deleted IS DISTINCT FROM true` (handles NULL correctly).
-- The old index was never dropped, leaving two overlapping partial unique
-- indexes on the same column. This migration removes the redundant one.
-- =============================================================================

DROP INDEX IF EXISTS idx_accounts_user_default;
