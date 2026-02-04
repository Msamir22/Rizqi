/**
 * UI Constants for consistent spacing and sizing across the app
 */

/** Height of the custom bottom tab bar including safe area */
export const TAB_BAR_HEIGHT = 80;

/** Size of the central microphone button */
export const MIC_BUTTON_SIZE = 64;

/** Size of quick action buttons */
export const QUICK_ACTION_SIZE = 48;

/** Tab bar blur intensity */
export const TAB_BAR_BLUR_INTENSITY = 80;

/** Animation spring config for quick actions */
export const QUICK_ACTION_SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.8,
} as const;
