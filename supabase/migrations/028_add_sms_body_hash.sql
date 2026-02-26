-- Migration 028: Add sms_body_hash column for SMS transaction deduplication
-- Feature: 007-sms-transaction-sync

ALTER TABLE public.transactions
  ADD COLUMN sms_body_hash TEXT;

-- Partial index for fast duplicate lookups during SMS scan
-- Only indexes non-null values since most transactions won't have this field
CREATE INDEX idx_transactions_sms_body_hash
  ON public.transactions (sms_body_hash)
  WHERE sms_body_hash IS NOT NULL;
