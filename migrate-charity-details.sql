-- Migration: add phone, website, charity_no columns to charities table
-- Run once in Supabase SQL editor

ALTER TABLE charities ADD COLUMN IF NOT EXISTS phone      TEXT;
ALTER TABLE charities ADD COLUMN IF NOT EXISTS website    TEXT;
ALTER TABLE charities ADD COLUMN IF NOT EXISTS charity_no TEXT;

-- Update existing charity with its details (replace values as needed)
-- UPDATE charities SET phone = '07737188124', website = 'www.nlcsunderland.uk', charity_no = '117881' WHERE id = 1;
