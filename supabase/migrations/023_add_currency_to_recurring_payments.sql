-- Add currency column to recurring_payments table
-- Default to 'EGP' for existing records
ALTER TABLE recurring_payments
  ADD COLUMN currency currency_type NOT NULL DEFAULT 'EGP';
