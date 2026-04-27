/**
 * Voice Entry Service
 *
 * Decouples the mic-button tooltip's "Try it now" action from the tab layout's
 * `useVoiceTransactionFlow` hook. The tab layout registers its `startFlow`
 * function during mount and unregisters on unmount; any consumer can then
 * call `openVoiceEntry()` to trigger the voice recording overlay without
 * importing React or hooks.
 *
 * Pattern: Mediator — a lightweight module-level registry that bridges hook-
 * bound state to imperative callers.
 *
 * @module voice-entry-service
 */

import { logger } from "@/utils/logger";

// =============================================================================
// Types
// =============================================================================

/** A no-arg function that opens the voice recording overlay. */
type VoiceEntryFn = () => void;

// =============================================================================
// Registry
// =============================================================================

/** The currently registered voice entry handler, or null if none is mounted. */
let registeredVoiceEntry: VoiceEntryFn | null = null;

// =============================================================================
// Public API
// =============================================================================

/**
 * Register a voice entry handler. Called once by the tab layout during mount.
 *
 * Callers SHOULD pair this with `unregisterVoiceEntry()` in an effect cleanup
 * so the registry does not retain a stale closure across tab-layout unmounts
 * (logout → re-login, hot reload, future multi-window app architecture).
 *
 * @param fn - The `startFlow` function from `useVoiceTransactionFlow`.
 */
export function registerVoiceEntry(fn: VoiceEntryFn): void {
  if (registeredVoiceEntry !== null && registeredVoiceEntry !== fn) {
    // Double-registration is usually benign (hot reload re-runs the effect),
    // but flag it so unexpected double-mounts are visible.
    logger.warn(
      "voice-entry-service.registerVoiceEntry: replacing existing handler"
    );
  }
  registeredVoiceEntry = fn;
}

/**
 * Clear the registered voice entry handler. Call from the tab layout's effect
 * cleanup to prevent a stale `startFlow` closure from being invoked after
 * the tab tree has unmounted.
 */
export function unregisterVoiceEntry(): void {
  registeredVoiceEntry = null;
}

/**
 * Open the voice recording overlay from any caller (e.g. tooltip "Try it now").
 *
 * No-ops with a warning if no handler has been registered yet (e.g. the tab
 * layout has not mounted).
 */
export function openVoiceEntry(): void {
  if (!registeredVoiceEntry) {
    logger.warn("voice-entry-service.openVoiceEntry: no handler registered");
    return;
  }
  registeredVoiceEntry();
}
