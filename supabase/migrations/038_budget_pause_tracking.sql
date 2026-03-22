-- Migration: Add pause tracking columns to budgets
-- Purpose: Support "Freeze & Exclude" behavior — transactions during
-- paused windows are permanently excluded from spending calculations.

-- paused_at: timestamp when the budget was most recently paused (NULL when active)
-- pause_intervals: JSONB array of {from, to} epoch-ms intervals for historical pauses
ALTER TABLE budgets
  ADD COLUMN paused_at TIMESTAMPTZ,
  ADD COLUMN pause_intervals JSONB NOT NULL DEFAULT '[]'::jsonb;
