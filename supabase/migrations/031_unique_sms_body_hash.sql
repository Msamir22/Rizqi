-- ============================================================================
-- 031: Unique constraint on sms_body_hash per user
-- Prevents duplicate SMS transactions from being saved for the SAME user.
-- Different users may have the same sms_body_hash (same SMS forwarded, etc.).
-- Uses partial index (WHERE sms_body_hash IS NOT NULL) so that
-- manual/voice transactions without hashes are unaffected.
-- ============================================================================

-- Step 1: Clean up existing duplicates in transactions (keep oldest row)
DELETE FROM transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, sms_body_hash
             ORDER BY created_at ASC
           ) AS rn
    FROM transactions
    WHERE sms_body_hash IS NOT NULL
  ) dupes
  WHERE rn > 1
);

-- Step 2: Clean up existing duplicates in transfers (keep oldest row)
DELETE FROM transfers
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, sms_body_hash
             ORDER BY created_at ASC
           ) AS rn
    FROM transfers
    WHERE sms_body_hash IS NOT NULL
  ) dupes
  WHERE rn > 1
);

-- Step 3: Create partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_sms_hash
  ON transactions (user_id, sms_body_hash)
  WHERE sms_body_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_unique_sms_hash
  ON transfers (user_id, sms_body_hash)
  WHERE sms_body_hash IS NOT NULL;
