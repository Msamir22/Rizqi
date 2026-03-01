-- Migration 030: Add sms_body_hash column to transfers table for SMS dedup
-- Mirrors migration 028 which added the same column to transactions.
-- Used to detect and skip already-processed ATM withdrawal SMS messages.

ALTER TABLE public.transfers
  ADD COLUMN sms_body_hash TEXT;

-- Partial index: only index rows that have a hash (most transfers won't)
CREATE INDEX idx_transfers_sms_body_hash
  ON public.transfers (sms_body_hash)
  WHERE sms_body_hash IS NOT NULL;
