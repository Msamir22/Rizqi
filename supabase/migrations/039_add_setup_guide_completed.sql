-- Add setup_guide_completed to profiles
-- Tracks whether the dashboard setup guide card has been completed/dismissed.
-- Separate from onboarding_completed which tracks the main onboarding carousel.
ALTER TABLE profiles
  ADD COLUMN setup_guide_completed BOOLEAN NOT NULL DEFAULT false;
