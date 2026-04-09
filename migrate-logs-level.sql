-- Migration: add level column to console_logs
-- Run once in Supabase SQL editor

ALTER TABLE console_logs ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'info';

-- Back-fill existing rows based on keywords in the message
UPDATE console_logs SET level = 'error'   WHERE log_message ILIKE '%error%'   AND level = 'info';
UPDATE console_logs SET level = 'warning' WHERE log_message ILIKE '%warning%' AND level = 'info';
UPDATE console_logs SET level = 'warning' WHERE log_message ILIKE '%failed%'  AND level = 'info';
UPDATE console_logs SET level = 'warning' WHERE log_message ILIKE '%invalid%' AND level = 'info';
