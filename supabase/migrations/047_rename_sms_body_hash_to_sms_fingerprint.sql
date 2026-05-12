-- Rename SMS deduplication storage from the old body-only hash to a
-- timestamp-aware fingerprint. The app is still in development, so old
-- body-hash values are intentionally discarded instead of backfilled.

DROP INDEX IF EXISTS public.idx_transactions_unique_sms_hash;
DROP INDEX IF EXISTS public.idx_transfers_unique_sms_hash;
DROP INDEX IF EXISTS public.idx_transactions_sms_body_hash;
DROP INDEX IF EXISTS public.idx_transfers_sms_body_hash;

ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS sms_body_hash,
  ADD COLUMN IF NOT EXISTS sms_fingerprint TEXT;

ALTER TABLE public.transfers
  DROP COLUMN IF EXISTS sms_body_hash,
  ADD COLUMN IF NOT EXISTS sms_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_sms_fingerprint
  ON public.transactions (sms_fingerprint)
  WHERE sms_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transfers_sms_fingerprint
  ON public.transfers (sms_fingerprint)
  WHERE sms_fingerprint IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_sms_fingerprint
  ON public.transactions (user_id, sms_fingerprint)
  WHERE sms_fingerprint IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_unique_sms_fingerprint
  ON public.transfers (user_id, sms_fingerprint)
  WHERE sms_fingerprint IS NOT NULL;
