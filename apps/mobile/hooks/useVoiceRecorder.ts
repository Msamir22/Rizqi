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

/**
 * Delay (ms) after calling `record()` before marking the recorder as ready.
 * Gives Android's MediaRecorder.start() time to transition on the native thread.
 *
 * Exported for test usage so tests reference the same constant.
 */
export const NATIVE_STABILIZATION_DELAY_MS = 300;

/**
 * Maximum time (ms) stop() will wait for the native recorder to become ready
 * before giving up. Prevents indefinite hangs if start() fails silently.
 */
const STOP_READINESS_TIMEOUT_MS = 2000;

/** Polling interval (ms) for readiness checks in stop(). */
const READINESS_POLL_INTERVAL_MS = 50;

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
  /** Reset recorder back to idle state (delegates to discard if active) */
  readonly reset: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Polls until `conditionFn` returns true or `timeoutMs` elapses.
 * Resolves `true` if the condition was met, `false` on timeout.
 */
function waitForCondition(
  conditionFn: () => boolean,
  timeoutMs: number,
  pollMs: number
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (conditionFn()) {
      resolve(true);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (conditionFn()) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, pollMs);
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceRecorder(): VoiceRecorderResult {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  // Refs for timer management
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const accumulatedMsRef = useRef<number>(0);

  /**
   * Tracks whether the native MediaRecorder is in a state that accepts
   * pause/stop. Set to `true` after `record()` + stabilization delay,
   * and `false` after `stop()` or on error recovery.
   */
  const nativeReadyRef = useRef(false);

  /**
   * Ref to track the current status synchronously (avoids stale closure
   * issues in callbacks where React state hasn't re-rendered yet).
   */
  const statusRef = useRef<RecorderStatus>("idle");

  /**
   * Tracks the in-flight start promise so discard() can await it
   * before attempting cleanup. Prevents race conditions where discard()
   * clears state while start()'s stabilization delay is still pending.
   */
  const nativeStartPromiseRef = useRef<Promise<void> | null>(null);

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
        if (!nativeReadyRef.current) return;
        try {
          stopTimer();
          nativeReadyRef.current = false;
          statusRef.current = "completed";
          await audioRecorder.stop();
          setAudioUri(audioRecorder.uri ?? null);
          setStatus("completed");
        } catch (err: unknown) {
          console.error("[useVoiceRecorder] Auto-stop failed:", err);
          // Recover: mark as completed anyway since we hit the limit
          nativeReadyRef.current = false;
          setAudioUri(audioRecorder.uri ?? null);
          setStatus("completed");
        }
      })();
    }
  }, [status, durationMs, audioRecorder, stopTimer]);

  // ---------------------------------------------------------------------------
  // Recording controls
  // ---------------------------------------------------------------------------

  const start = useCallback(async (): Promise<void> => {
    const startPromise = (async (): Promise<void> => {
      try {
        // Set audio mode for recording
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });

        // Reset state
        accumulatedMsRef.current = 0;
        nativeReadyRef.current = false;
        setDurationMs(0);
        setAudioUri(null);

        // Prepare and start recording
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();

        setStatus("recording");
        statusRef.current = "recording";
        startTimer();

        // Allow the native MediaRecorder time to transition before
        // accepting pause/stop commands. This prevents the
        // IllegalStateException on Android when the user taps quickly.
        await new Promise<void>((resolve) =>
          setTimeout(resolve, NATIVE_STABILIZATION_DELAY_MS)
        );

        // Only set ready if we haven't been cancelled (discard during warmup)
        if (
          statusRef.current === "recording" ||
          statusRef.current === "paused"
        ) {
          nativeReadyRef.current = true;
        }
      } catch (err: unknown) {
        console.error("[useVoiceRecorder] Start failed:", err);
        nativeReadyRef.current = false;
        statusRef.current = "idle";
        setStatus("idle");
      }
    })();

    nativeStartPromiseRef.current = startPromise;
    try {
      await startPromise;
    } finally {
      nativeStartPromiseRef.current = null;
    }
  }, [audioRecorder, startTimer]);

  const pause = useCallback((): void => {
    if (statusRef.current !== "recording") return;

    if (!nativeReadyRef.current) {
      console.warn(
        "[useVoiceRecorder] Ignoring pause — native recorder still initializing"
      );
      return;
    }

    try {
      stopTimer();
      audioRecorder.pause();
      statusRef.current = "paused";
      setStatus("paused");
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Pause failed:", err);
      // Don't change status — the recording may still be active natively
    }
  }, [audioRecorder, stopTimer]);

  const resume = useCallback((): void => {
    if (statusRef.current !== "paused") return;
    try {
      audioRecorder.record();
      statusRef.current = "recording";
      setStatus("recording");
      startTimer();
      // No stabilization delay needed for resume — MediaRecorder.resume()
      // transitions synchronously on Android
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Resume failed:", err);
    }
  }, [audioRecorder, startTimer]);

  const stop = useCallback(async (): Promise<{
    uri: string;
    durationMs: number;
  } | null> => {
    if (statusRef.current !== "recording" && statusRef.current !== "paused") {
      return null;
    }

    // If native recorder isn't ready yet (user tapped stop during warmup),
    // wait for readiness rather than silently returning null.
    if (!nativeReadyRef.current) {
      // First, await any in-flight start promise
      if (nativeStartPromiseRef.current) {
        try {
          await nativeStartPromiseRef.current;
        } catch {
          // Start failed — nothing to stop
          return null;
        }
      }

      // Poll until nativeReadyRef becomes true or timeout
      const ready = await waitForCondition(
        () => nativeReadyRef.current,
        STOP_READINESS_TIMEOUT_MS,
        READINESS_POLL_INTERVAL_MS
      );

      if (!ready) {
        console.warn(
          "[useVoiceRecorder] Stop timed out waiting for native readiness"
        );
        return null;
      }
    }

    try {
      stopTimer();
      nativeReadyRef.current = false;
      statusRef.current = "completed";
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return null;

      setAudioUri(uri);
      setStatus("completed");
      return { uri, durationMs: accumulatedMsRef.current };
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Stop failed:", err);
      nativeReadyRef.current = false;
      statusRef.current = "idle";
      setStatus("idle");
      return null;
    }
  }, [audioRecorder, stopTimer]);

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

      // Await any in-flight start() so the stabilization delay doesn't
      // flip nativeReadyRef back to true after we've cleared state.
      if (nativeStartPromiseRef.current) {
        try {
          await nativeStartPromiseRef.current;
        } catch {
          // Start failed — proceed with cleanup anyway
        }
      }

      // Stop recording only if native recorder is ready (active)
      if (nativeReadyRef.current) {
        nativeReadyRef.current = false;
        try {
          await audioRecorder.stop();
        } catch (stopErr: unknown) {
          // Swallow stop errors during discard — we're cleaning up anyway
          console.warn(
            "[useVoiceRecorder] Stop during discard failed:",
            stopErr
          );
        }
      }

      // Delete the temp file (FR-021)
      const uri = audioRecorder.uri ?? audioUri;
      if (uri) {
        await deleteAudioFile(uri);
      }

      // Reset state
      accumulatedMsRef.current = 0;
      nativeReadyRef.current = false;
      statusRef.current = "idle";
      setDurationMs(0);
      setAudioUri(null);
      setStatus("idle");
    } catch (err: unknown) {
      console.error("[useVoiceRecorder] Discard failed:", err);
      statusRef.current = "idle";
      setStatus("idle");
    }
  }, [audioRecorder, audioUri, stopTimer, deleteAudioFile]);

  /**
   * Reset recorder back to idle. If the recorder is in an active state
   * (recording/paused), delegates to discard() for proper native cleanup
   * and temp file deletion.
   */
  const reset = useCallback(async (): Promise<void> => {
    const currentStatus = statusRef.current;

    if (currentStatus === "recording" || currentStatus === "paused") {
      // Active state — must do proper native teardown + file cleanup
      await discard();
      return;
    }

    // Idle or completed — just clear JS state (no native cleanup needed)
    stopTimer();
    accumulatedMsRef.current = 0;
    nativeReadyRef.current = false;
    statusRef.current = "idle";
    setDurationMs(0);
    setAudioUri(null);
    setStatus("idle");
  }, [stopTimer, discard]);

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
