-- ============================================================
-- dedup-transactions.sql
-- Remove duplicate rows from the transactions table and add
-- a unique constraint to prevent future duplicates on import.
--
-- Run once in Supabase SQL editor.
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT guards.
-- ============================================================

-- Step 1: Drop the index if it already exists so we can safely dedup first.
DROP INDEX IF EXISTS uq_transactions_dedup;

-- Step 2: Normalise paid_in / paid_out so '178.6' and '178.60' are the same.
-- ROUND to 2dp then cast back to text; avoids trailing-dot issue with FM format masks.
UPDATE transactions
SET paid_in = ROUND(paid_in::NUMERIC, 2)::TEXT
WHERE paid_in ~ '^\d+\.?\d*$';

UPDATE transactions
SET paid_out = ROUND(paid_out::NUMERIC, 2)::TEXT
WHERE paid_out ~ '^\d+\.?\d*$';

-- Step 3: Delete duplicate rows, keeping the lowest id per group.
DELETE FROM transactions
WHERE id NOT IN (
    SELECT MIN(id)
    FROM transactions
    GROUP BY
        date,
        description,
        COALESCE(paid_in,  ''),
        COALESCE(paid_out, ''),
        charity_id
);

-- Step 4: Recreate the unique index now that duplicates are gone.
CREATE UNIQUE INDEX uq_transactions_dedup
    ON transactions (
        date,
        description,
        COALESCE(paid_in,  ''),
        COALESCE(paid_out, ''),
        charity_id
    );

-- Verify: should return 0.
SELECT COUNT(*) - COUNT(DISTINCT (date, description, COALESCE(paid_in,''), COALESCE(paid_out,''), charity_id))
    AS remaining_duplicates
FROM transactions;
