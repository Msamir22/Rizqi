/* eslint-disable */

import { setOnboardingFlag } from "@/services/profile-service";
import { database } from "@rizqi/db";

jest.mock("@rizqi/db", () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

jest.mock("@/services/supabase", () => ({
  getCurrentUserId: jest.fn().mockResolvedValue("user-123"),
}));

jest.mock("@/services/onboarding-cursor-service", () => ({
  clearOnboardingStep: jest.fn(),
}));

describe("setOnboardingFlag", () => {
  const mockWrite = database.write as jest.MockedFunction<
    typeof database.write
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("merges new flag into existing flags", async () => {
    const state: { onboardingFlagsRaw: string } = {
      onboardingFlagsRaw: '{"cash_account_tooltip_dismissed":true}',
    };
    const mockUpdate = jest.fn((updater: (p: typeof state) => void) => {
      updater(state);
    });

    const mockProfile = {
      userId: "user-123",
      get onboardingFlags(): Record<string, unknown> {
        try {
          return JSON.parse(state.onboardingFlagsRaw) as Record<
            string,
            unknown
          >;
        } catch {
          return {};
        }
      },
      update: mockUpdate,
    };

    (database.get as jest.Mock).mockReturnValue({
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockProfile]),
      }),
    });

    mockWrite.mockImplementation(async (fn) => fn(undefined as never));

    await setOnboardingFlag("voice_tooltip_seen", true);

    expect(mockWrite).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    const parsed = JSON.parse(state.onboardingFlagsRaw) as Record<
      string,
      unknown
    >;
    expect(parsed.cash_account_tooltip_dismissed).toBe(true);
    expect(parsed.voice_tooltip_seen).toBe(true);
  });

  it("is idempotent — setting same flag twice does not remove other keys", async () => {
    const state: { onboardingFlagsRaw: string } = {
      onboardingFlagsRaw: '{"cash_account_tooltip_dismissed":true}',
    };

    const mockUpdate = jest.fn((updater) => updater(state));

    const mockProfile = {
      userId: "user-123",
      get onboardingFlags() {
        try {
          return JSON.parse(state.onboardingFlagsRaw);
        } catch {
          return {};
        }
      },
      update: mockUpdate,
    };

    (database.get as jest.Mock).mockReturnValue({
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockProfile]),
      }),
    });

    mockWrite.mockImplementation(async (fn) => fn(undefined as never));

    await setOnboardingFlag("cash_account_tooltip_dismissed", true);

    const parsed = JSON.parse(state.onboardingFlagsRaw);
    expect(parsed.cash_account_tooltip_dismissed).toBe(true);
  });

  it("does not remove existing keys when adding a new one", async () => {
    const state: { onboardingFlagsRaw: string } = {
      onboardingFlagsRaw: '{"cash_account_tooltip_dismissed":true}',
    };

    const mockUpdate = jest.fn((updater) => updater(state));

    const mockProfile = {
      userId: "user-123",
      get onboardingFlags() {
        try {
          return JSON.parse(state.onboardingFlagsRaw);
        } catch {
          return {};
        }
      },
      update: mockUpdate,
    };

    (database.get as jest.Mock).mockReturnValue({
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockProfile]),
      }),
    });

    mockWrite.mockImplementation(async (fn) => fn(undefined as never));

    await setOnboardingFlag("voice_tooltip_seen", true);

    const parsed = JSON.parse(state.onboardingFlagsRaw);
    expect(parsed.cash_account_tooltip_dismissed).toBe(true);
    expect(parsed.voice_tooltip_seen).toBe(true);
  });
});
