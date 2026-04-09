-- ============================================================
-- Multi-tenant migration: add charities table + charity_id
-- Run once in Supabase SQL editor (safe to re-run — idempotent)
-- ============================================================

BEGIN;

-- ── 1. Create charities table ────────────────────────────────
CREATE TABLE IF NOT EXISTS charities (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  email      TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the existing single tenant with id=1
INSERT INTO charities (id, name, slug, email)
VALUES (1, 'NewLife Church Sunderland', 'newlife-sunderland', '')
ON CONFLICT (id) DO NOTHING;

-- Ensure the sequence starts at 2 for subsequent inserts
SELECT setval('charities_id_seq', (SELECT MAX(id) FROM charities), true);

-- ── 2. Add charity_id columns (nullable first) ───────────────
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','members','donations','transactions',
    'transaction_types','donation_types','offering_claim',
    'console_logs','terms_acceptance','bank_connections',
    'bank_balances','bank_transactions','bank_sync_log'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = tbl
        AND column_name  = 'charity_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN charity_id INTEGER REFERENCES charities(id)',
        tbl
      );
      RAISE NOTICE 'Added charity_id to %', tbl;
    ELSE
      RAISE NOTICE 'charity_id already exists on %, skipping', tbl;
    END IF;
  END LOOP;
END $$;

-- ── 3. Backfill all existing rows to charity_id = 1 ─────────
UPDATE users             SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE members           SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE donations         SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE transactions      SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE transaction_types SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE donation_types    SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE offering_claim    SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE console_logs      SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE terms_acceptance  SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE bank_connections  SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE bank_balances     SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE bank_transactions SET charity_id = 1 WHERE charity_id IS NULL;
UPDATE bank_sync_log     SET charity_id = 1 WHERE charity_id IS NULL;

-- ── 4. Enforce NOT NULL ──────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','members','donations','transactions',
    'transaction_types','donation_types','offering_claim',
    'console_logs','terms_acceptance','bank_connections',
    'bank_balances','bank_transactions','bank_sync_log'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN charity_id SET NOT NULL',
      tbl
    );
  END LOOP;
END $$;

-- ── 5. Performance indexes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_charity             ON users(charity_id);
CREATE INDEX IF NOT EXISTS idx_members_charity           ON members(charity_id);
CREATE INDEX IF NOT EXISTS idx_donations_charity         ON donations(charity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_charity      ON transactions(charity_id);
CREATE INDEX IF NOT EXISTS idx_transaction_types_charity ON transaction_types(charity_id);
CREATE INDEX IF NOT EXISTS idx_donation_types_charity    ON donation_types(charity_id);
CREATE INDEX IF NOT EXISTS idx_offering_claim_charity    ON offering_claim(charity_id);
CREATE INDEX IF NOT EXISTS idx_console_logs_charity      ON console_logs(charity_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_charity  ON terms_acceptance(charity_id);
CREATE INDEX IF NOT EXISTS idx_bank_connections_charity  ON bank_connections(charity_id);
CREATE INDEX IF NOT EXISTS idx_bank_balances_charity     ON bank_balances(charity_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_charity ON bank_transactions(charity_id);
CREATE INDEX IF NOT EXISTS idx_bank_sync_log_charity     ON bank_sync_log(charity_id);

-- ── 6. Scoped uniqueness constraints ────────────────────────
-- email unique per charity (not globally)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_charity_unique;
ALTER TABLE users ADD CONSTRAINT users_email_charity_unique
  UNIQUE (email, charity_id);

-- transaction types unique per charity
ALTER TABLE transaction_types DROP CONSTRAINT IF EXISTS transaction_types_type_key;
ALTER TABLE transaction_types DROP CONSTRAINT IF EXISTS transaction_types_type_charity_unique;
ALTER TABLE transaction_types ADD CONSTRAINT transaction_types_type_charity_unique
  UNIQUE (type, charity_id);

-- donation types unique per charity
ALTER TABLE donation_types DROP CONSTRAINT IF EXISTS donation_types_type_key;
ALTER TABLE donation_types DROP CONSTRAINT IF EXISTS donation_types_type_charity_unique;
ALTER TABLE donation_types ADD CONSTRAINT donation_types_type_charity_unique
  UNIQUE (type, charity_id);

-- ── 7. Verification ──────────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
  cnt INTEGER;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users','members','donations','transactions',
    'transaction_types','donation_types','offering_claim',
    'console_logs','terms_acceptance','bank_connections',
    'bank_balances','bank_transactions','bank_sync_log'
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE charity_id IS NULL', tbl) INTO cnt;
    IF cnt > 0 THEN
      RAISE EXCEPTION 'VERIFICATION FAILED: % has % rows with NULL charity_id', tbl, cnt;
    END IF;
  END LOOP;
  RAISE NOTICE 'All tables verified — no NULL charity_id rows.';
END $$;

COMMIT;
