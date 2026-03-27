/**
 * useVoiceRecorder.test.ts — T022
 *
 * Tests the useVoiceRecorder hook's state machine, permission flow,
 * and recording lifecycle.
 *
 * Mock Strategy:
 *   - expo-audio: mocked entirely to avoid native module dependencies
 *   - expo-file-system: mocked for temp file cleanup testing
 *   - Lightweight renderHook utility from react-test-renderer (project pattern)
 */

import React, { createElement, useState } from "react";

// ---------------------------------------------------------------------------
// react-test-renderer — manual types & import (project pattern)
// ---------------------------------------------------------------------------

interface ReactTestRendererInstance {
  unmount: () => void;
}

interface ReactTestRendererModule {
  act: (...args: unknown[]) => unknown;
  create: (element: React.ReactElement) => ReactTestRendererInstance;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const RTR: ReactTestRendererModule = require("react-test-renderer");

const actSync = RTR.act as (fn: () => void) => void;
const actAsync = RTR.act as (fn: () => Promise<void>) => Promise<void>;

// ---------------------------------------------------------------------------
// Mock state tracking
// ---------------------------------------------------------------------------

const mockRecord = jest.fn();
const mockPause = jest.fn();
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockPrepareToRecordAsync = jest.fn().mockResolvedValue(undefined);
const mockRelease = jest.fn();
const mockRequestPermissions = jest.fn().mockResolvedValue({ granted: true });
const mockSetAudioModeAsync = jest.fn().mockResolvedValue(undefined);
const mockDeleteAsync = jest.fn().mockResolvedValue(undefined);
const mockGetInfoAsync = jest.fn().mockResolvedValue({ exists: true });

const mockRecorder = {
  record: mockRecord,
  pause: mockPause,
  stop: mockStop,
  prepareToRecordAsync: mockPrepareToRecordAsync,
  release: mockRelease,
  getUri: jest.fn().mockReturnValue("file:///tmp/recording.m4a"),
  uri: "file:///tmp/recording.m4a",
};

jest.mock("expo-audio", () => ({
  AudioModule: {
    AudioRecorder: jest.fn(() => mockRecorder),
    requestRecordingPermissionsAsync: (...args: unknown[]): Promise<unknown> =>
      mockRequestPermissions(...args) as Promise<unknown>,
    getRecordingPermissionsAsync: (): Promise<{ granted: boolean }> =>
      Promise.resolve({ granted: false }),
  },
  RecordingPresets: {
    HIGH_QUALITY: {
      extension: ".m4a",
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
      android: {
        outputFormat: "mpeg4",
        audioEncoder: "aac",
      },
    },
  },
  setAudioModeAsync: (...args: unknown[]): Promise<unknown> =>
    mockSetAudioModeAsync(...args) as Promise<unknown>,
}));

jest.mock("expo-file-system", () => ({
  deleteAsync: (...args: unknown[]): Promise<unknown> =>
    mockDeleteAsync(...args) as Promise<unknown>,
  getInfoAsync: (...args: unknown[]): Promise<unknown> =>
    mockGetInfoAsync(...args) as Promise<unknown>,
}));

// ---------------------------------------------------------------------------
// Import module under test — after mocks
// ---------------------------------------------------------------------------

import {
  useVoiceRecorder,
  NATIVE_STABILIZATION_DELAY_MS,
} from "@/hooks/useVoiceRecorder";

// ---------------------------------------------------------------------------
// Lightweight renderHook utility (project pattern)
// ---------------------------------------------------------------------------

const mountedUnmounts: Array<() => void> = [];

interface HookRef<T> {
  current: T | null;
}

function unwrap<T>(ref: HookRef<T>): T {
  if (ref.current === null) {
    throw new Error("Hook ref is null — did the component render?");
  }
  return ref.current;
}

function renderHook<T>(hookFn: () => T): {
  result: HookRef<T>;
  rerender: () => void;
  unmount: () => void;
} {
  const result: HookRef<T> = { current: null };
  let forceUpdate: (() => void) | null = null;

  function TestComponent(): null {
    result.current = hookFn();
    const [, setState] = useState(0);
    forceUpdate = () => setState((n) => n + 1);
    return null;
  }

  let renderer: ReactTestRendererInstance;

  actSync(() => {
    renderer = RTR.create(createElement(TestComponent));
  });

  mountedUnmounts.push(() => {
    actSync(() => {
      renderer.unmount();
    });
  });

  return {
    result,
    rerender: () => {
      actSync(() => {
        forceUpdate?.();
      });
    },
    unmount: () => {
      actSync(() => {
        renderer.unmount();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: start recording with stabilization delay flush
// When start() is called with jest.useFakeTimers(), the stabilization
// setTimeout won't resolve until we advance timers. This helper handles
// the full sequence: kick off start, advance timers, flush microtasks.
// ---------------------------------------------------------------------------

async function startRecordingWithFlush(
  result: HookRef<ReturnType<typeof useVoiceRecorder>>
): Promise<void> {
  // start() internally does:
  //   1. await setAudioModeAsync()      — async, resolves via microtask
  //   2. await prepareToRecordAsync()   — async, resolves via microtask
  //   3. record()                       — synchronous
  //   4. setStatus("recording")         — synchronous
  //   5. startTimer()                   — synchronous (schedules interval)
  //   6. await setTimeout(NATIVE_STABILIZATION_DELAY_MS) — needs fake timer advance
  //   7. nativeReadyRef.current = true  — after setTimeout resolves
  //
  // With fake timers we must:
  //   a) Kick off start() (don't await — it will hang on step 6)
  //   b) Flush microtasks so steps 1-5 complete and setTimeout is scheduled
  //   c) Advance fake timers by the stabilization delay to fire the setTimeout
  //   d) Flush microtasks again so step 7 completes

  await actAsync(async () => {
    const hook = unwrap(result);
    const startPromise = hook.start(); // kick off, don't await

    // Flush microtasks so prepareToRecordAsync + setAudioModeAsync resolve
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Now setTimeout is scheduled — advance fake timers
    jest.advanceTimersByTime(NATIVE_STABILIZATION_DELAY_MS);

    // Flush microtasks so the setTimeout callback (nativeReadyRef = true) runs
    await Promise.resolve();

    // Wait for start() to fully complete
    await startPromise;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useVoiceRecorder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    mountedUnmounts.splice(0).forEach((fn) => fn());
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // =========================================================================
  // Initial state
  // =========================================================================
  describe("initial state", () => {
    it("should start with idle status", () => {
      const { result } = renderHook(() => useVoiceRecorder());
      const hook = unwrap(result);
      expect(hook.status).toBe("idle");
      expect(hook.isRecording).toBe(false);
      expect(hook.durationMs).toBe(0);
      expect(hook.audioUri).toBeNull();
    });
  });

  // =========================================================================
  // Permission
  // =========================================================================
  describe("requestPermission", () => {
    it("should request and grant permission", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      let granted = false;
      await actAsync(async () => {
        granted = await unwrap(result).requestPermission();
      });

      expect(granted).toBe(true);
      expect(unwrap(result).hasPermission).toBe(true);
    });

    it("should return false when permission is denied", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: false });
      const { result } = renderHook(() => useVoiceRecorder());

      let granted = true;
      await actAsync(async () => {
        granted = await unwrap(result).requestPermission();
      });

      expect(granted).toBe(false);
      expect(unwrap(result).hasPermission).toBe(false);
    });
  });

  // =========================================================================
  // Start recording
  // =========================================================================
  describe("start", () => {
    it("should request permission and transition to recording", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingWithFlush(result);

      expect(unwrap(result).status).toBe("recording");
      expect(unwrap(result).isRecording).toBe(true);
      expect(mockPrepareToRecordAsync).toHaveBeenCalled();
      expect(mockRecord).toHaveBeenCalled();
    });

    it("should fall back to idle if prepareToRecordAsync throws", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      mockPrepareToRecordAsync.mockRejectedValueOnce(
        new Error("Native module error")
      );
      const { result } = renderHook(() => useVoiceRecorder());

      await actAsync(async () => {
        void unwrap(result).start();
        jest.advanceTimersByTime(NATIVE_STABILIZATION_DELAY_MS);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(unwrap(result).status).toBe("idle");
    });
  });

  // =========================================================================
  // Pause / Resume
  // =========================================================================
  describe("pause and resume", () => {
    it("should transition to paused status on pause", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingWithFlush(result);

      actSync(() => {
        unwrap(result).pause();
      });

      expect(unwrap(result).status).toBe("paused");
      expect(mockPause).toHaveBeenCalled();
    });

    it("should transition back to recording on resume", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingWithFlush(result);

      actSync(() => {
        unwrap(result).pause();
      });

      actSync(() => {
        unwrap(result).resume();
      });

      expect(unwrap(result).status).toBe("recording");
      // start calls record once, resume calls again
      expect(mockRecord).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Stop recording
  // =========================================================================
  describe("stop", () => {
    it("should transition to completed and return audio URI", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingWithFlush(result);

      let stopResult: { uri: string; durationMs: number } | null = null;
      await actAsync(async () => {
        stopResult = await unwrap(result).stop();
      });

      expect(unwrap(result).status).toBe("completed");
      expect(stopResult).not.toBeNull();
      if (stopResult) {
        expect((stopResult as { uri: string }).uri).toBe(
          "file:///tmp/recording.m4a"
        );
      }
    });

    it("should wait for native readiness if stop is called during warmup (fast-tap)", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      // Kick off start but do NOT flush the stabilization delay yet
      await actAsync(async () => {
        const hook = unwrap(result);
        const startPromise = hook.start();

        // Flush microtasks so prepareToRecordAsync resolves, but NOT the timer
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // Now call stop() — native is NOT ready yet, so it should poll/await
        const stopPromise = hook.stop();

        // Advance timers to fire the stabilization delay AND the readiness poll
        jest.advanceTimersByTime(NATIVE_STABILIZATION_DELAY_MS + 100);
        await Promise.resolve();
        await Promise.resolve();

        // Let the promises settle
        await startPromise;
        const stopRes = await stopPromise;

        // stop() should have waited and returned a valid result
        expect(stopRes).not.toBeNull();
        if (stopRes) {
          expect(stopRes.uri).toBe("file:///tmp/recording.m4a");
        }
      });

      expect(unwrap(result).status).toBe("completed");
    });
  });

  // =========================================================================
  // Discard
  // =========================================================================
  describe("discard", () => {
    it("should clean up temp file and reset to idle (FR-021)", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingWithFlush(result);

      await actAsync(async () => {
        await unwrap(result).stop();
      });

      await actAsync(async () => {
        await unwrap(result).discard();
      });

      expect(mockDeleteAsync).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
      expect(unwrap(result).status).toBe("idle");
      expect(unwrap(result).audioUri).toBeNull();
    });

    it("should handle discard during warmup window without leaving native recorder running", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      // Kick off start but don't flush the stabilization delay
      await actAsync(async () => {
        const hook = unwrap(result);
        const startPromise = hook.start();

        // Flush microtasks so prepareToRecordAsync resolves
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // Call discard during warmup — should await the start promise
        const discardPromise = hook.discard();

        // Advance timers to let stabilization delay and cleanup complete
        jest.advanceTimersByTime(NATIVE_STABILIZATION_DELAY_MS + 100);
        await Promise.resolve();
        await Promise.resolve();

        await startPromise;
        await discardPromise;
      });

      expect(unwrap(result).status).toBe("idle");
    });
  });

  // =========================================================================
  // Reset
  // =========================================================================
  describe("reset", () => {
    it("should reset all state back to idle from completed", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingWithFlush(result);

      await actAsync(async () => {
        await unwrap(result).stop();
      });

      await actAsync(async () => {
        await unwrap(result).reset();
      });

      expect(unwrap(result).status).toBe("idle");
      expect(unwrap(result).durationMs).toBe(0);
      expect(unwrap(result).audioUri).toBeNull();
    });

    it("should delegate to discard when called during recording", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      await startRecordingWithFlush(result);
      expect(unwrap(result).status).toBe("recording");

      // reset() while recording should call discard() internally
      await actAsync(async () => {
        await unwrap(result).reset();
      });

      expect(unwrap(result).status).toBe("idle");
      // discard calls stop on the native recorder
      expect(mockStop).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Auto-stop at 60 seconds (FR-004)
  // =========================================================================
  describe("auto-stop at 60 seconds", () => {
    it("should auto-stop recording when elapsed time reaches 60s", async () => {
      mockRequestPermissions.mockResolvedValueOnce({ granted: true });
      const { result } = renderHook(() => useVoiceRecorder());

      // 1. Start recording (includes stabilization delay flush)
      await startRecordingWithFlush(result);
      expect(unwrap(result).status).toBe("recording");

      // 2. Advance past the 60s limit; the hook's 100ms interval
      //    will accumulate durationMs which triggers the auto-stop useEffect
      actSync(() => {
        jest.advanceTimersByTime(60_000);
      });

      // 3. Flush microtasks so the auto-stop async IIFE
      //    (audioRecorder.stop() + setStatus("completed")) settles
      await actAsync(async () => {
        await Promise.resolve();
      });

      expect(mockStop).toHaveBeenCalled();
      expect(unwrap(result).status).toBe("completed");
    });
  });
});
