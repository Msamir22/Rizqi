-- Migration: Convert market_rates id from integer to UUID

-- Step 1: Temporarily set replica identity to FULL (allows updates during migration)
ALTER TABLE market_rates REPLICA IDENTITY FULL;

-- Step 2: Drop the primary key constraint
ALTER TABLE market_rates DROP CONSTRAINT IF EXISTS market_rates_pkey;

-- Step 3: Remove default from id column (to release sequence dependency)
ALTER TABLE market_rates ALTER COLUMN id DROP DEFAULT;

-- Step 4: Drop the sequence (no longer needed)
DROP SEQUENCE IF EXISTS market_rates_id_seq;

-- Step 5: Add a new UUID column with default
ALTER TABLE market_rates ADD COLUMN new_id uuid DEFAULT gen_random_uuid();

-- Step 6: Generate UUIDs for existing rows
UPDATE market_rates SET new_id = gen_random_uuid() WHERE new_id IS NULL;

-- Step 7: Drop the old integer id column
ALTER TABLE market_rates DROP COLUMN id;

-- Step 8: Rename new_id to id
ALTER TABLE market_rates RENAME COLUMN new_id TO id;

-- Step 9: Make id NOT NULL
ALTER TABLE market_rates ALTER COLUMN id SET NOT NULL;

-- Step 10: Add primary key on UUID id
ALTER TABLE market_rates ADD PRIMARY KEY (id);

-- Step 11: Reset replica identity to use primary key
ALTER TABLE market_rates REPLICA IDENTITY DEFAULT;
