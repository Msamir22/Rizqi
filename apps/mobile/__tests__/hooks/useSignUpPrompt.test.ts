/**
 * Unit tests for useSignUpPrompt hook
 *
 * Uses @testing-library/react-native's renderHook to properly exercise
 * the hook lifecycle. Tests T022–T026 from tasks.md.
 *
 * Architecture & Design Rationale:
 * - Pattern: renderHook + act for async state assertions
 * - Why: Previous tests only exercised mock calls without running the hook.
 *   renderHook ensures useEffect/useState actually execute.
 */

import { renderHook, act, waitFor } from "@testing-library/react-native";

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

      await waitFor(() => {
        expect(result.current.stats.isLoading).toBe(false);
      });

      expect(result.current.shouldShowPrompt).toBe(false);
      expect(result.current.stats.transactionCount).toBe(5);
      expect(result.current.stats.accountCount).toBe(2);
      expect(result.current.stats.totalAmount).toBe(150);
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

      await waitFor(() => {
        expect(result.current.stats.isLoading).toBe(false);
      });

      expect(result.current.shouldShowPrompt).toBe(true);
      expect(result.current.stats.transactionCount).toBe(55);
    });

    it("shows prompt at exactly 50 transactions (boundary)", async () => {
      setupAnonymousUser();
      mockCheckResult(true, {
        transactionCount: 50,
        accountCount: 2,
        totalAmount: 8000,
      });

      const { result } = renderHook(() => useSignUpPrompt());

      await waitFor(() => {
        expect(result.current.stats.isLoading).toBe(false);
      });

      expect(result.current.shouldShowPrompt).toBe(true);
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

      await waitFor(() => {
        expect(result.current.shouldShowPrompt).toBe(true);
      });

      await act(async () => {
        await result.current.dismissWithCooldown();
      });

      expect(result.current.shouldShowPrompt).toBe(false);
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

      await waitFor(() => {
        expect(result.current.shouldShowPrompt).toBe(true);
      });

      await act(async () => {
        await result.current.dismissPermanently();
      });

      expect(result.current.shouldShowPrompt).toBe(false);
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

      await waitFor(() => {
        expect(result.current.stats.isLoading).toBe(false);
      });

      expect(result.current.shouldShowPrompt).toBe(false);
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

      await waitFor(() => {
        expect(result.current.stats.isLoading).toBe(false);
      });

      expect(result.current.shouldShowPrompt).toBe(false);
    });
  });
});
