/**
 * useVoiceTransactionFlow Hook
 *
 * Orchestrates the full voice-to-transaction flow:
 * 1. Recording (via useVoiceRecorder)
 * 2. AI submission (via ai-voice-parser-service)
 * 3. Navigation to review screen on success
 *
 * Architecture & Design Rationale:
 * - Pattern: Orchestrator / Facade
 * - Why: Coordinates multiple concerns (recording, AI submission,
 *   navigation, error handling) behind a single interface. Components
 *   consume one hook instead of managing three.
 * - SOLID: SRP — orchestration only. DIP — depends on abstractions
 *   (service functions, hook interfaces), not concrete implementations.
 *
 * @module useVoiceTransactionFlow
 */

import { useCallback, useState, useRef } from "react";
import { router } from "expo-router";
import { useVoiceRecorder } from "./useVoiceRecorder";
import {
  parseVoiceWithAi,
  isVoiceParserError,
} from "@/services/ai-voice-parser-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowStatus =
  | "idle"
  | "recording"
  | "paused"
  | "completed"
  | "analyzing"
  | "success"
  | "error";

interface VoiceTransactionFlowResult {
  /** Current flow status */
  readonly flowStatus: FlowStatus;
  /** Whether the recording overlay should be visible */
  readonly isOverlayVisible: boolean;
  /** Elapsed recording time in milliseconds */
  readonly durationMs: number;
  /** Error message for display */
  readonly errorMessage: string | null;
  /** Whether microphone permission is granted */
  readonly hasPermission: boolean;

  // Actions
  /** Open overlay and start recording */
  readonly startFlow: () => Promise<void>;
  /** Pause recording */
  readonly pauseRecording: () => void;
  /** Resume recording */
  readonly resumeRecording: () => void;
  /** Stop recording and submit to AI */
  readonly submitRecording: () => Promise<void>;
  /** Discard recording and close overlay */
  readonly discardRecording: () => Promise<void>;
  /** Retry recording from error state */
  readonly retryRecording: () => Promise<void>;
}

interface FlowConfig {
  /** User's preferred currency code */
  readonly preferredCurrency: string;
  /** User's category tree string */
  readonly categories?: string;
  /** User's accounts for AI matching */
  readonly accounts?: ReadonlyArray<{ id: string; name: string }>;
  /** Origin tab index (for post-save navigation) */
  readonly originTabIndex?: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceTransactionFlow(
  config: FlowConfig
): VoiceTransactionFlowResult {
  const recorder = useVoiceRecorder();

  const [flowStatus, setFlowStatus] = useState<FlowStatus>("idle");
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Store origin tab for post-save navigation
  const originTabIndexRef = useRef(config.originTabIndex ?? 0);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const startFlow = useCallback(async (): Promise<void> => {
    // Request permission first if needed
    if (!recorder.hasPermission) {
      const granted = await recorder.requestPermission();
      if (!granted) {
        setErrorMessage(
          "Microphone permission is required for voice recording. Please enable it in Settings."
        );
        setFlowStatus("error");
        setIsOverlayVisible(true);
        return;
      }
    }

    // Reset state and start recording
    setErrorMessage(null);
    setIsOverlayVisible(true);
    setFlowStatus("recording");
    originTabIndexRef.current = config.originTabIndex ?? 0;

    await recorder.start();
  }, [recorder, config.originTabIndex]);

  const pauseRecording = useCallback((): void => {
    recorder.pause();
    setFlowStatus("paused");
  }, [recorder]);

  const resumeRecording = useCallback((): void => {
    recorder.resume();
    setFlowStatus("recording");
  }, [recorder]);

  const submitRecording = useCallback(async (): Promise<void> => {
    // Stop recording
    const result = await recorder.stop();
    if (!result) {
      setErrorMessage("Failed to finalize recording. Please try again.");
      setFlowStatus("error");
      return;
    }

    // Show analyzing state
    setFlowStatus("analyzing");

    // Submit to AI
    const aiResult = await parseVoiceWithAi({
      audioUri: result.uri,
      preferredCurrency: config.preferredCurrency,
      categories: config.categories,
      accounts: config.accounts,
    });

    // Clean up temp audio file (FR-021)
    await recorder.discard();

    // Handle result
    if (isVoiceParserError(aiResult)) {
      setErrorMessage(aiResult.message);
      setFlowStatus("error");
      return;
    }

    // Success — navigate to review screen
    setFlowStatus("success");
    setIsOverlayVisible(false);

    // Navigate to voice review with parsed data
    router.push({
      pathname: "/voice-review" as never,
      params: {
        transactions: JSON.stringify(aiResult.transactions),
        transcript: aiResult.transcript,
        originTabIndex: String(originTabIndexRef.current),
      },
    });

    // Reset for next use
    recorder.reset();
    setFlowStatus("idle");
  }, [recorder, config.preferredCurrency, config.categories, config.accounts]);

  const discardRecording = useCallback(async (): Promise<void> => {
    await recorder.discard();
    setIsOverlayVisible(false);
    setFlowStatus("idle");
    setErrorMessage(null);
  }, [recorder]);

  const retryRecording = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    setFlowStatus("recording");
    await recorder.start();
  }, [recorder]);

  return {
    flowStatus,
    isOverlayVisible,
    durationMs: recorder.durationMs,
    errorMessage,
    hasPermission: recorder.hasPermission,
    startFlow,
    pauseRecording,
    resumeRecording,
    submitRecording,
    discardRecording,
    retryRecording,
  };
}
