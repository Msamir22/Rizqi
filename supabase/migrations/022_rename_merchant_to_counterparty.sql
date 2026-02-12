-- =============================================================================
-- Migration 022: Rename merchant to counterparty
-- Description: Renames the `merchant` column to `counterparty` in the
--              transactions table. "Counterparty" is a standard financial term
--              for "the other party in a transaction" — works as Payee (expense)
--              and Payer (income).
-- =============================================================================

ALTER TABLE transactions RENAME COLUMN merchant TO counterparty;
