-- Recreate unique SMS fingerprint indexes so databases that already applied an
-- earlier definition receive the current soft-delete-aware predicate.

DROP INDEX IF EXISTS public.idx_transactions_unique_sms_fingerprint;
DROP INDEX IF EXISTS public.idx_transfers_unique_sms_fingerprint;

CREATE UNIQUE INDEX idx_transactions_unique_sms_fingerprint
  ON public.transactions (user_id, sms_fingerprint)
  WHERE sms_fingerprint IS NOT NULL AND deleted = false;

CREATE UNIQUE INDEX idx_transfers_unique_sms_fingerprint
  ON public.transfers (user_id, sms_fingerprint)
  WHERE sms_fingerprint IS NOT NULL AND deleted = false;
