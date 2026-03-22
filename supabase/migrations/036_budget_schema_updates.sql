-- =============================================================================
-- Migration 036: Budget Schema Updates
-- Feature: Budget Management UI & Spending Progress Tracking (Issue #39)
-- =============================================================================
-- 1. Make 'currency' column optional so budgets can default to user's
--    preferred currency when not explicitly set.
-- 2. Add 'alert_fired_level' column to track which alert threshold has been
--    triggered in the current budget period (prevents duplicate alerts).
--    Values: NULL (no alert), 'WARNING' (threshold crossed), 'DANGER' (100% exceeded).
--    Reset to NULL on period boundary by the client.
-- =============================================================================

-- 1. Make currency nullable
ALTER TABLE budgets ALTER COLUMN currency DROP NOT NULL;

-- 2. Add alert deduplication tracking column
ALTER TABLE budgets ADD COLUMN alert_fired_level TEXT;

-- Add a CHECK constraint for valid alert_fired_level values
ALTER TABLE budgets ADD CONSTRAINT chk_alert_fired_level
  CHECK (alert_fired_level IS NULL OR alert_fired_level IN ('WARNING', 'DANGER'));
