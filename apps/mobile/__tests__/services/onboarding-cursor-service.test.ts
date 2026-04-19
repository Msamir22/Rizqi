/**
 * @file onboarding-cursor-service.test.ts
 * @description Unit tests for the AsyncStorage-backed onboarding cursor.
 *
 * Validates:
 * - Correct key format: `onboarding:<userId>:step`.
 * - Read returns null when absent or when the stored value is not a valid
 *   step (defensive against stale/corrupted writes).
 * - Write + clear round-trip.
 * - Per-user isolation (two different userIds do not collide).
 * - clear is idempotent (removing an absent key is a no-op).
 */

// =============================================================================
// Mock: AsyncStorage
// =============================================================================

jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(
        (key: string): Promise<string | null> =>
          Promise.resolve(store.get(key) ?? null)
      ),
      setItem: jest.fn((key: string, value: string): Promise<void> => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string): Promise<void> => {
        store.delete(key);
        return Promise.resolve();
      }),
      __store: store,
    },
  };
});

// =============================================================================
// Imports (after mocks)
// =============================================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  readOnboardingStep,
  writeOnboardingStep,
  clearOnboardingStep,
  type OnboardingStep,
} from "@/services/onboarding-cursor-service";

const mockStore = (AsyncStorage as unknown as { __store: Map<string, string> })
  .__store;

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

// =============================================================================
// Tests
// =============================================================================

describe("key format", () => {
  it("writes to the key `onboarding:<userId>:step`", async (): Promise<void> => {
    await writeOnboardingStep("user-123", "slides");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "onboarding:user-123:step",
      "slides"
    );
  });

  it("reads from the key `onboarding:<userId>:step`", async (): Promise<void> => {
    await writeOnboardingStep("user-123", "currency");
    await readOnboardingStep("user-123");
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(
      "onboarding:user-123:step"
    );
  });
});

describe("readOnboardingStep", () => {
  it("returns null when the key is absent", async (): Promise<void> => {
    expect(await readOnboardingStep("user-404")).toBeNull();
  });

  it("returns the stored step when one of the four valid values", async (): Promise<void> => {
    const steps: OnboardingStep[] = [
      "language",
      "slides",
      "currency",
      "cash-account",
    ];
    for (const step of steps) {
      await writeOnboardingStep("user-1", step);
      expect(await readOnboardingStep("user-1")).toBe(step);
    }
  });

  it("returns null when the stored value is garbage (defensive)", async (): Promise<void> => {
    await AsyncStorage.setItem("onboarding:user-bad:step", "not-a-step");
    expect(await readOnboardingStep("user-bad")).toBeNull();
  });
});

describe("writeOnboardingStep", () => {
  it("persists the step", async (): Promise<void> => {
    await writeOnboardingStep("user-1", "slides");
    expect(mockStore.get("onboarding:user-1:step")).toBe("slides");
  });

  it("overwrites an existing value", async (): Promise<void> => {
    await writeOnboardingStep("user-1", "language");
    await writeOnboardingStep("user-1", "currency");
    expect(mockStore.get("onboarding:user-1:step")).toBe("currency");
  });
});

describe("clearOnboardingStep", () => {
  it("removes the cursor for the given user", async (): Promise<void> => {
    await writeOnboardingStep("user-1", "slides");
    await clearOnboardingStep("user-1");
    expect(mockStore.has("onboarding:user-1:step")).toBe(false);
    expect(await readOnboardingStep("user-1")).toBeNull();
  });

  it("is idempotent — removing an absent key is a no-op", async (): Promise<void> => {
    await expect(clearOnboardingStep("user-404")).resolves.toBeUndefined();
  });
});

describe("per-user isolation", () => {
  it("does not leak cursor state between different userIds", async (): Promise<void> => {
    await writeOnboardingStep("user-A", "slides");
    await writeOnboardingStep("user-B", "currency");

    expect(await readOnboardingStep("user-A")).toBe("slides");
    expect(await readOnboardingStep("user-B")).toBe("currency");
  });

  it("clearing one user's cursor does not affect another user's", async (): Promise<void> => {
    await writeOnboardingStep("user-A", "slides");
    await writeOnboardingStep("user-B", "currency");

    await clearOnboardingStep("user-A");

    expect(await readOnboardingStep("user-A")).toBeNull();
    expect(await readOnboardingStep("user-B")).toBe("currency");
  });
});
