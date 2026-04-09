-- Migration: link donations to transactions
-- Run once in Supabase SQL editor

ALTER TABLE donations ADD COLUMN IF NOT EXISTS transaction_id INTEGER REFERENCES transactions(id);

CREATE INDEX IF NOT EXISTS idx_donations_transaction_id ON donations(transaction_id);
