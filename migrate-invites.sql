-- Migration: add invites table
-- Run once in Supabase SQL editor

CREATE TABLE IF NOT EXISTS invites (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  charity_id INTEGER NOT NULL REFERENCES charities(id),
  role       TEXT NOT NULL DEFAULT 'user',
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_token      ON invites (token);
CREATE INDEX IF NOT EXISTS idx_invites_charity_id ON invites (charity_id);
