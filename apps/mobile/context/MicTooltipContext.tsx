/**
 * MicTooltipContext
 *
 * Holds the transient `isVisible` state for the first-run mic tooltip and
 * exposes the persisted-flag handlers (`show`, `dismiss`, `tryItNow`).
 *
 * ## Why a context, why not just `useState` inside `useOnboardingGuide`?
 *
 * The mic-tooltip OVERLAY needs to render at the **screen root** so its
 * `absoluteFillObject` backdrop covers the whole window and the anchored
 * card isn't clipped by an ancestor's `overflow-hidden`. The
 * `OnboardingGuideCard` (which previously hosted both the visibility state
 * AND the tooltip JSX) lives inside a ScrollView and sets
 * `overflow-hidden` on its visual card — rendering the tooltip there made
 * the card's coordinate system parent-relative instead of window-relative,
 * so the user only saw a dim band where the card sat instead of a real
 * tooltip. (User-reported regression, 2026-04-26: "Voice tooltip doesn't
 * show on first tap, just dim backdrop.")
 *
 * Splitting the state into a context lets:
 *   - `OnboardingGuideCard` trigger `show()` from its voice-step button.
 *   - `app/(tabs)/index.tsx` render `<MicButtonTooltip>` at the dashboard
 *     root, where the overlay is screen-anchored.
 *
 * Persistence (`voice_tooltip_seen` on `profile.onboarding_flags`) stays
 * the canonical "any dismissal counts as seen forever" signal per FR-024a.
 *
 * @module MicTooltipContext
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useOnboardingFlags } from "@/hooks/useOnboardingFlags";
import { setOnboardingFlag } from "@/services/profile-service";
import { openVoiceEntry } from "@/services/voice-entry-service";
import { logger } from "@/utils/logger";

interface MicTooltipState {
  /** Whether the tooltip overlay should currently render. */
  readonly isVisible: boolean;
  /** True once the user has dismissed the tooltip at least once (persisted). */
  readonly voiceTooltipSeen: boolean;
  /**
   * Triggered from the voice-step button. If never seen → show tooltip;
   * otherwise open voice entry directly.
   */
  readonly onVoiceStepAction: () => void;
  /** "Try it now" — persists seen flag, opens voice flow on success. */
  readonly onTryItNow: () => void;
  /** X / hardware-back / backdrop tap — persists seen flag only. */
  readonly onDismiss: () => void;
}

const MicTooltipContext = createContext<MicTooltipState | null>(null);

export function MicTooltipProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false);
  const flags = useOnboardingFlags();
  const voiceTooltipSeen = flags.voice_tooltip_seen === true;

  /**
   * Persist the voice-tooltip-seen flag, then hide. Local visibility is
   * flipped only AFTER the write resolves so a failed write keeps the
   * tooltip on screen and the persisted flag stays in sync. See FR-024a.
   */
  const markSeen = useCallback(
    async (afterSuccess?: () => void): Promise<void> => {
      try {
        await setOnboardingFlag("voice_tooltip_seen", true);
        setIsVisible(false);
        afterSuccess?.();
      } catch (error: unknown) {
        logger.warn(
          "micTooltip.markSeen.failed",
          error instanceof Error ? { message: error.message } : { error }
        );
        // Leave tooltip visible — user can retry.
      }
    },
    []
  );

  const onVoiceStepAction = useCallback((): void => {
    if (voiceTooltipSeen) {
      openVoiceEntry();
    } else {
      setIsVisible(true);
    }
  }, [voiceTooltipSeen]);

  const onTryItNow = useCallback((): void => {
    void markSeen(openVoiceEntry);
  }, [markSeen]);

  const onDismiss = useCallback((): void => {
    void markSeen();
  }, [markSeen]);

  const value = useMemo<MicTooltipState>(
    () => ({
      isVisible,
      voiceTooltipSeen,
      onVoiceStepAction,
      onTryItNow,
      onDismiss,
    }),
    [isVisible, voiceTooltipSeen, onVoiceStepAction, onTryItNow, onDismiss]
  );

  return (
    <MicTooltipContext.Provider value={value}>
      {children}
    </MicTooltipContext.Provider>
  );
}

/**
 * Strict consumer — throws when used outside `MicTooltipProvider`. The
 * provider is mounted at `(tabs)/_layout.tsx`, so every consumer below the
 * tab navigator is guaranteed to have it. Throwing is the right behavior
 * here (vs. defaulting to `null`) because a missing provider means the
 * tooltip can never appear and the bug would silently disappear in tests.
 */
export function useMicTooltip(): MicTooltipState {
  const ctx = useContext(MicTooltipContext);
  if (!ctx) {
    throw new Error("useMicTooltip must be used inside MicTooltipProvider");
  }
  return ctx;
}
