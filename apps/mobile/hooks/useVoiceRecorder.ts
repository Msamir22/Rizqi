/**
 * useVoiceRecorder Hook
 *
 * Encapsulates the expo-audio recording lifecycle with state management,
 * auto-stop at 60 seconds, and temp file cleanup.
 *
 * Architecture & Design Rationale:
 * - Pattern: Custom Hook (Adapter Pattern)
 * - Why: Isolates native recording API behind a clean React interface.
 *   Components only see status/actions, never the raw AudioRecorder.
 * - SOLID: SRP — recording only. OCP — extends via status callbacks
 *   without modifying existing consumers.
 *
 * @module useVoiceRecorder
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum recording duration in seconds (FR-004). */
const MAX_RECORDING_DURATION_S = 60;

/** Timer tick interval in milliseconds. */
const TIMER_TICK_MS = 100;

/** Polling interval for recorder state in milliseconds. */
const STATE_POLL_INTERVAL_MS = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecorderStatus = "idle" | "recording" | "paused" | "completed";

interface VoiceRecorderResult {
  /** Current recording status */
  readonly status: RecorderStatus;
  /** Elapsed recording time in milliseconds (excludes paused time) */
  readonly durationMs: number;
  /** Whether the recorder is currently recording (convenience) */
  readonly isRecording: boolean;
  /** Audio URI after recording completes */
  readonly audioUri: string | null;
  /** Whether microphone permission is granted */
  readonly hasPermission: boolean;
  /** Start a new recording */
  readonly start: () => Promise<void>;
  /** Pause the current recording */
  readonly pause: () => void;
  /** Resume a paused recording */
  readonly resume: () => void;
  /** Stop the recording and finalize the audio file */
  readonly stop: () => Promise<{ uri: string; durationMs: number } | null>;
  /** Discard the recording and clean up temp files (FR-021) */
  readonly discard: () => Promise<void>;
  /** Request microphone permission */
  readonly requestPermission: () => Promise<boolean>;
  /** Reset recorder back to idle state */
  readonly reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceRecorder(): VoiceRecorderResult {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(
    audioRecorder,
    STATE_POLL_INTERVAL_MS
  );

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  // Refs for timer management
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const accumulatedMsRef = useRef<number>(0);

  // ---------------------------------------------------------------------------
  // Permission
  // ---------------------------------------------------------------------------

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const result = await AudioModule.requestRecordingPermissionsAsync();
      setHasPermission(result.granted);
      return result.granted;
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Permission request failed:", err);
      return false;
    }
  }, []);

  // Check permission on mount
  useEffect(() => {
    void AudioModule.getRecordingPermissionsAsync().then(
      (result: { granted: boolean }) => {
        setHasPermission(result.granted);
      }
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Timer helpers
  // ---------------------------------------------------------------------------

  const startTimer = useCallback((): void => {
    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      accumulatedMsRef.current += delta;
      setDurationMs(accumulatedMsRef.current);
    }, TIMER_TICK_MS);
  }, []);

  const stopTimer = useCallback((): void => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  // ---------------------------------------------------------------------------
  // Auto-stop at 60 seconds (FR-004: does NOT auto-submit)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (
      status === "recording" &&
      durationMs >= MAX_RECORDING_DURATION_S * 1000
    ) {
      // Auto-stop but stay in overlay — user must choose Done or Discard
      void (async () => {
        try {
          stopTimer();
          await audioRecorder.stop();
          setAudioUri(audioRecorder.uri ?? null);
          setStatus("completed");
        } catch (err: unknown) {
          console.error("[useVoiceRecorder] Auto-stop failed:", err);
        }
      })();
    }
  }, [status, durationMs, audioRecorder, stopTimer]);

  // ---------------------------------------------------------------------------
  // Recording controls
  // ---------------------------------------------------------------------------

  const start = useCallback(async (): Promise<void> => {
    try {
      // Set audio mode for recording
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      // Reset state
      accumulatedMsRef.current = 0;
      setDurationMs(0);
      setAudioUri(null);

      // Prepare and start recording
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setStatus("recording");
      startTimer();
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Start failed:", err);
      setStatus("idle");
    }
  }, [audioRecorder, startTimer]);

  const pause = useCallback((): void => {
    if (status !== "recording") return;
    try {
      stopTimer();
      audioRecorder.pause();
      setStatus("paused");
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Pause failed:", err);
    }
  }, [status, audioRecorder, stopTimer]);

  const resume = useCallback((): void => {
    if (status !== "paused") return;
    try {
      audioRecorder.record();
      setStatus("recording");
      startTimer();
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Resume failed:", err);
    }
  }, [status, audioRecorder, startTimer]);

  const stop = useCallback(async (): Promise<{
    uri: string;
    durationMs: number;
  } | null> => {
    if (status !== "recording" && status !== "paused") return null;
    try {
      stopTimer();
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return null;

      setAudioUri(uri);
      setStatus("completed");
      return { uri, durationMs: accumulatedMsRef.current };
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Stop failed:", err);
      return null;
    }
  }, [status, audioRecorder, stopTimer]);

  // ---------------------------------------------------------------------------
  // Cleanup (FR-021: temp file MUST be deleted)
  // ---------------------------------------------------------------------------

  const deleteAudioFile = useCallback(async (uri: string): Promise<void> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch (err: unknown) {
      console.warn("[useVoiceRecorder] Failed to delete temp audio:", err);
    }
  }, []);

  const discard = useCallback(async (): Promise<void> => {
    try {
      stopTimer();

      // Stop recording if still active
      if (recorderState.isRecording) {
        await audioRecorder.stop();
      }

      // Delete the temp file (FR-021)
      const uri = audioRecorder.uri ?? audioUri;
      if (uri) {
        await deleteAudioFile(uri);
      }

      // Reset state
      accumulatedMsRef.current = 0;
      setDurationMs(0);
      setAudioUri(null);
      setStatus("idle");
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Discard failed:", err);
      setStatus("idle");
    }
  }, [
    audioRecorder,
    audioUri,
    recorderState.isRecording,
    stopTimer,
    deleteAudioFile,
  ]);

  const reset = useCallback((): void => {
    stopTimer();
    accumulatedMsRef.current = 0;
    setDurationMs(0);
    setAudioUri(null);
    setStatus("idle");
  }, [stopTimer]);

  return {
    status,
    durationMs,
    isRecording: status === "recording",
    audioUri,
    hasPermission,
    start,
    pause,
    resume,
    stop,
    discard,
    requestPermission,
    reset,
  };
}
