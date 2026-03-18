-- =============================================================================
-- Migration 033: Add Unique Default Account Constraint
-- Feature: Edit Account & Delete Account (Issue #45)
-- =============================================================================
-- Ensures at most one account per user can have is_default = true.
-- This is a partial unique index — only active (non-deleted) default accounts
-- are constrained. This prevents multi-device sync edge cases from creating
-- duplicate defaults.
-- =============================================================================

CREATE UNIQUE INDEX idx_accounts_one_default_per_user
  ON public.accounts (user_id)
  WHERE is_default = true AND deleted IS DISTINCT FROM true;
