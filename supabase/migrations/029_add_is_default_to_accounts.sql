-- Add is_default flag to accounts table.
-- Only one account per user can be the default.
-- Used as fallback when SMS transactions can't be matched to a specific account.

ALTER TABLE accounts ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Partial unique index: ensures at most one default per user among non-deleted rows
CREATE UNIQUE INDEX idx_accounts_user_default
  ON accounts (user_id) WHERE is_default = true AND deleted = false;
