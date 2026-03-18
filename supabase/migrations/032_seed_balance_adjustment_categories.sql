-- =============================================================================
-- Migration 032: Seed Balance Adjustment Categories
-- Feature: Edit Account & Delete Account (Issue #45)
-- =============================================================================
-- Two system-managed, non-deletable categories for tracked balance adjustments.
-- These categories are used when a user edits an account balance and chooses
-- "Track as Transaction" to record the difference as income or expense.
-- =============================================================================

INSERT INTO public.categories (
  id, user_id, parent_id, system_name, display_name, icon, level, nature, type, is_system, is_internal, sort_order
) VALUES
  (
    '00000000-0000-0000-0001-000000000200',
    NULL, NULL,
    'balance_adjustment_income',
    'Balance Adjustment (Income)',
    '📈', 1, NULL, 'INCOME', true, true, 200
  ),
  (
    '00000000-0000-0000-0001-000000000201',
    NULL, NULL,
    'balance_adjustment_expense',
    'Balance Adjustment (Expense)',
    '📉', 1, NULL, 'EXPENSE', true, true, 201
  )
ON CONFLICT DO NOTHING;
