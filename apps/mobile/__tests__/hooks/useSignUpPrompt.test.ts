/**
 * Unit tests for useSignUpPrompt hook
 *
 * Uses the project's lightweight renderHook utility (same pattern as
 * useSmsPermission.test.ts) to properly exercise the hook lifecycle.
 * Tests T022–T026 from tasks.md.
 *
 * Architecture & Design Rationale:
 * - Pattern: renderHook + act for async state assertions
 * - Why: Tests must execute the hook's useEffect/useState lifecycle.
 *   Mocks the service layer instead of AsyncStorage/DB directly.
 */

import React from "react";

// ---------------------------------------------------------------------------
// react-test-renderer — manual types & import
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
// Mocks — must be set up before imports
// ---------------------------------------------------------------------------

const mockCheckShouldShowPrompt = jest.fn();
const mockSaveCooldownDismissal = jest.fn();
const mockSavePermanentDismissal = jest.fn();

jest.mock("@/services/signup-prompt-service", () => ({
  checkShouldShowPrompt: (...args: unknown[]): unknown =>
    mockCheckShouldShowPrompt(...args),
  saveCooldownDismissal: (...args: unknown[]): unknown =>
    mockSaveCooldownDismissal(...args),
  savePermanentDismissal: (...args: unknown[]): unknown =>
    mockSavePermanentDismissal(...args),
}));

const mockUseAuth = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: (): { isAnonymous: boolean } =>
    mockUseAuth() as { isAnonymous: boolean },
}));

import { useSignUpPrompt } from "../../hooks/useSignUpPrompt";

// ---------------------------------------------------------------------------
// Lightweight renderHook utility
// ---------------------------------------------------------------------------

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
    const [, setState] = React.useState(0);
    forceUpdate = () => setState((n) => n + 1);
    return null;
  }

  let renderer: ReactTestRendererInstance;

  actSync(() => {
    renderer = RTR.create(React.createElement(TestComponent));
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

async function flushPromises(): Promise<void> {
  await actAsync(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupAnonymousUser(): void {
  mockUseAuth.mockReturnValue({ isAnonymous: true });
}

function setupAuthenticatedUser(): void {
  mockUseAuth.mockReturnValue({ isAnonymous: false });
}

function mockCheckResult(
  shouldShow: boolean,
  stats = { transactionCount: 0, accountCount: 0, totalAmount: 0 }
): void {
  mockCheckShouldShowPrompt.mockResolvedValue({ shouldShow, stats });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("useSignUpPrompt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveCooldownDismissal.mockResolvedValue(undefined);
    mockSavePermanentDismissal.mockResolvedValue(undefined);
  });

  // =========================================================================
  // T022: Anonymous user below thresholds → shouldShowPrompt = false
  // =========================================================================

  describe("T022: below thresholds", () => {
    it("returns shouldShowPrompt=false when service reports no threshold met", async () => {
      setupAnonymousUser();
      mockCheckResult(false, {
        transactionCount: 5,
        accountCount: 2,
        totalAmount: 150,
      });

      const { result } = renderHook(() => useSignUpPrompt());
      await flushPromises();

      expect(unwrap(result).stats.isLoading).toBe(false);
      expect(unwrap(result).shouldShowPrompt).toBe(false);
      expect(unwrap(result).stats.transactionCount).toBe(5);
      expect(unwrap(result).stats.accountCount).toBe(2);
      expect(unwrap(result).stats.totalAmount).toBe(150);
    });
  });

  // =========================================================================
  // T023: Anonymous user at 50+ txns → shouldShowPrompt = true
  // =========================================================================

  describe("T023: above transaction threshold", () => {
    it("returns shouldShowPrompt=true when service reports threshold met", async () => {
      setupAnonymousUser();
      mockCheckResult(true, {
        transactionCount: 55,
        accountCount: 3,
        totalAmount: 12500,
      });

      const { result } = renderHook(() => useSignUpPrompt());
      await flushPromises();

      expect(unwrap(result).stats.isLoading).toBe(false);
      expect(unwrap(result).shouldShowPrompt).toBe(true);
      expect(unwrap(result).stats.transactionCount).toBe(55);
    });

    it("shows prompt at exactly 50 transactions (boundary)", async () => {
      setupAnonymousUser();
      mockCheckResult(true, {
        transactionCount: 50,
        accountCount: 2,
        totalAmount: 8000,
      });

      const { result } = renderHook(() => useSignUpPrompt());
      await flushPromises();

      expect(unwrap(result).stats.isLoading).toBe(false);
      expect(unwrap(result).shouldShowPrompt).toBe(true);
    });
  });

  // =========================================================================
  // T024: Cooldown dismiss logic
  // =========================================================================

  describe("T024: cooldown dismiss", () => {
    it("calls saveCooldownDismissal and sets shouldShowPrompt=false", async () => {
      setupAnonymousUser();
      mockCheckResult(true, {
        transactionCount: 55,
        accountCount: 3,
        totalAmount: 12500,
      });

      const { result } = renderHook(() => useSignUpPrompt());
      await flushPromises();

      expect(unwrap(result).shouldShowPrompt).toBe(true);

      await actAsync(async () => {
        await unwrap(result).dismissWithCooldown();
      });

      expect(unwrap(result).shouldShowPrompt).toBe(false);
      expect(mockSaveCooldownDismissal).toHaveBeenCalledWith(55);
    });
  });

  // =========================================================================
  // T025: Permanent dismiss
  // =========================================================================

  describe("T025: permanent dismiss", () => {
    it("calls savePermanentDismissal and sets shouldShowPrompt=false", async () => {
      setupAnonymousUser();
      mockCheckResult(true, {
        transactionCount: 60,
        accountCount: 4,
        totalAmount: 15000,
      });

      const { result } = renderHook(() => useSignUpPrompt());
      await flushPromises();

      expect(unwrap(result).shouldShowPrompt).toBe(true);

      await actAsync(async () => {
        await unwrap(result).dismissPermanently();
      });

      expect(unwrap(result).shouldShowPrompt).toBe(false);
      expect(mockSavePermanentDismissal).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // T026: Authenticated user → always false
  // =========================================================================

  describe("T026: authenticated user", () => {
    it("never shows prompt for non-anonymous user", async () => {
      setupAuthenticatedUser();

      const { result } = renderHook(() => useSignUpPrompt());
      await flushPromises();

      expect(unwrap(result).stats.isLoading).toBe(false);
      expect(unwrap(result).shouldShowPrompt).toBe(false);
      expect(mockCheckShouldShowPrompt).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("error handling", () => {
    it("sets shouldShowPrompt=false when service throws", async () => {
      setupAnonymousUser();
      mockCheckShouldShowPrompt.mockRejectedValue(new Error("DB error"));

      const { result } = renderHook(() => useSignUpPrompt());
      await flushPromises();

      expect(unwrap(result).stats.isLoading).toBe(false);
      expect(unwrap(result).shouldShowPrompt).toBe(false);
    });
  });
});
