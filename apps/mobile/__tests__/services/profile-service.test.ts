/**
 * @file profile-service.test.ts
 * @description Unit tests for profile-service mutations (simplified data model).
 *
 * Mock strategy: inline factory pattern with __mocks re-export (project convention).
 */

// =============================================================================
// Mock: @rizqi/db
// =============================================================================

jest.mock("@rizqi/db", () => {
  const mockFind = jest.fn();
  const mockFetch = jest.fn();
  const mockWrite = jest.fn((fn: () => Promise<unknown>) => fn());

  const mockProfilesCollection = {
    find: mockFind,
    query: () => ({ fetch: mockFetch }),
  };

  return {
    database: {
      get: jest.fn((table: string) => {
        if (table === "profiles") return mockProfilesCollection;
        return {};
      }),
      write: mockWrite,
    },
    Account: {},
    Profile: {},
    __mocks: { mockFind, mockFetch, mockWrite },
  };
});

interface DbMocks {
  mockFind: jest.Mock;
  mockFetch: jest.Mock;
  mockWrite: jest.Mock;
}

function getDbMocks(): DbMocks {
  return jest.requireMock<{ __mocks: DbMocks }>("@rizqi/db").__mocks;
}

// =============================================================================
// Mock: account-service (ensureCashAccount)
// =============================================================================

jest.mock("@/services/account-service", () => {
  const ensureCashAccount = jest.fn(
    (): Promise<{
      created: boolean;
      accountId: string | null;
      error: string | null;
    }> =>
      Promise.resolve({
        created: true,
        accountId: "cash-account-1",
        error: null,
      })
  );
  return { ensureCashAccount, __mocks: { ensureCashAccount } };
});

interface AccountServiceMocks {
  ensureCashAccount: jest.Mock;
}

function getAccountServiceMocks(): AccountServiceMocks {
  return jest.requireMock<{ __mocks: AccountServiceMocks }>(
    "@/services/account-service"
  ).__mocks;
}

// =============================================================================
// Mock: onboarding-cursor-service (clearOnboardingStep)
// =============================================================================

jest.mock("@/services/onboarding-cursor-service", () => {
  const clearOnboardingStep = jest.fn().mockResolvedValue(undefined);
  return { clearOnboardingStep, __mocks: { clearOnboardingStep } };
});

interface CursorServiceMocks {
  clearOnboardingStep: jest.Mock;
}

function getCursorServiceMocks(): CursorServiceMocks {
  return jest.requireMock<{ __mocks: CursorServiceMocks }>(
    "@/services/onboarding-cursor-service"
  ).__mocks;
}

// =============================================================================
// Mock: i18n changeLanguage — setPreferredLanguage now owns the i18n apply
// per PR #238 review Finding #6. Mocking here prevents i18next state mutation
// (which would fail without loaded translation resources) during the unit test
// AND lets us assert the service invokes it.
// =============================================================================

jest.mock("@/i18n/changeLanguage", () => {
  const changeLanguage = jest.fn().mockResolvedValue(undefined);
  return { changeLanguage, __mocks: { changeLanguage } };
});

interface ChangeLanguageMocks {
  changeLanguage: jest.Mock;
}

function getChangeLanguageMocks(): ChangeLanguageMocks {
  return jest.requireMock<{ __mocks: ChangeLanguageMocks }>(
    "@/i18n/changeLanguage"
  ).__mocks;
}

// =============================================================================
// Mock: logger
// =============================================================================

jest.mock("@/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// =============================================================================
// Mock: supabase — profile-service imports getCurrentUserId. The real
// supabase client throws at module load when EXPO_PUBLIC_SUPABASE_URL is
// missing, so we provide a lightweight mock.
// =============================================================================

jest.mock("@/services/supabase", () => ({
  getCurrentUserId: jest.fn().mockResolvedValue("user-1"),
}));

// =============================================================================
// Import module under test (after mocks)
// =============================================================================

import {
  setPreferredLanguage,
  setPreferredCurrencyAndCreateCashAccount,
  completeOnboarding,
} from "@/services/profile-service";

// =============================================================================
// Helpers
// =============================================================================

function createMockProfile(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "profile-1",
    onboardingCompleted: false,
    preferredLanguage: "en",
    userId: "user-1",
    deleted: false,
    update: jest.fn((fn: (p: Record<string, unknown>) => void) => {
      fn(overrides);
    }),
    ...overrides,
  };
}

function setupProfileFound(
  profile: Record<string, unknown> = createMockProfile()
): void {
  const { mockFind, mockFetch } = getDbMocks();
  mockFind.mockResolvedValue(profile);
  mockFetch.mockResolvedValue([profile]);
}

function setupProfileNotFound(): void {
  const { mockFind, mockFetch } = getDbMocks();
  mockFind.mockRejectedValue(new Error("not found"));
  mockFetch.mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  const { mockWrite } = getDbMocks();
  mockWrite.mockImplementation((fn: () => Promise<unknown>) => fn());
});

// =============================================================================
// Tests
// =============================================================================

describe("setPreferredLanguage", () => {
  it("updates the profile's preferredLanguage field via database.write", async (): Promise<void> => {
    const profile = createMockProfile();
    setupProfileFound(profile);

    await setPreferredLanguage("en");

    const { mockWrite } = getDbMocks();
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it("also calls i18n changeLanguage so the UI updates in sync (guards PR #238 Finding #6)", async (): Promise<void> => {
    const profile = createMockProfile();
    setupProfileFound(profile);

    await setPreferredLanguage("en");

    const { changeLanguage } = getChangeLanguageMocks();
    expect(changeLanguage).toHaveBeenCalledTimes(1);
    expect(changeLanguage).toHaveBeenCalledWith("en");
  });

  it("accepts 'ar' as a supported language and forwards it to changeLanguage", async (): Promise<void> => {
    const profile = createMockProfile();
    setupProfileFound(profile);

    await setPreferredLanguage("ar");

    const { mockWrite } = getDbMocks();
    expect(mockWrite).toHaveBeenCalledTimes(1);
    const { changeLanguage } = getChangeLanguageMocks();
    expect(changeLanguage).toHaveBeenCalledWith("ar");
  });

  it("throws if no profile row exists", async (): Promise<void> => {
    setupProfileNotFound();
    await expect(setPreferredLanguage("en")).rejects.toThrow();
  });
});

describe("setPreferredCurrencyAndCreateCashAccount", () => {
  it("wraps profile update and ensureCashAccount in a single database.write", async (): Promise<void> => {
    const profile = createMockProfile({ userId: "user-1" });
    setupProfileFound(profile);

    const result = await setPreferredCurrencyAndCreateCashAccount("EGP");

    const { mockWrite } = getDbMocks();
    expect(mockWrite).toHaveBeenCalledTimes(1);

    const { ensureCashAccount } = getAccountServiceMocks();
    expect(ensureCashAccount).toHaveBeenCalledWith("user-1", "EGP");
    expect(result.accountId).toBe("cash-account-1");
  });

  it("returns existing accountId when cash account already exists (idempotent)", async (): Promise<void> => {
    const profile = createMockProfile({ userId: "user-1" });
    setupProfileFound(profile);

    const { ensureCashAccount } = getAccountServiceMocks();
    ensureCashAccount.mockResolvedValue({
      created: false,
      accountId: "existing-account",
      error: null,
    });

    const result = await setPreferredCurrencyAndCreateCashAccount("EGP");
    expect(result.accountId).toBe("existing-account");
  });
});

describe("completeOnboarding", () => {
  it("sets onboardingCompleted to true AND clears the AsyncStorage cursor", async (): Promise<void> => {
    const profile = createMockProfile({
      onboardingCompleted: false,
      userId: "user-1",
    });
    setupProfileFound(profile);

    await completeOnboarding();

    const { mockWrite } = getDbMocks();
    expect(mockWrite).toHaveBeenCalledTimes(1);

    const { clearOnboardingStep } = getCursorServiceMocks();
    expect(clearOnboardingStep).toHaveBeenCalledWith("user-1");
  });

  it("is idempotent — skips DB write when already completed but still clears cursor", async (): Promise<void> => {
    const profile = createMockProfile({
      onboardingCompleted: true,
      userId: "user-1",
    });
    setupProfileFound(profile);

    await completeOnboarding();

    const { mockWrite } = getDbMocks();
    expect(mockWrite).not.toHaveBeenCalled();

    const { clearOnboardingStep } = getCursorServiceMocks();
    expect(clearOnboardingStep).toHaveBeenCalledWith("user-1");
  });

  it("does NOT re-throw when cursor clear fails — DB write is contract-critical, cursor clear is best-effort", async (): Promise<void> => {
    const profile = createMockProfile({
      onboardingCompleted: false,
      userId: "user-1",
    });
    setupProfileFound(profile);

    const { clearOnboardingStep } = getCursorServiceMocks();
    clearOnboardingStep.mockRejectedValueOnce(
      new Error("AsyncStorage unavailable")
    );

    await expect(completeOnboarding()).resolves.toBeUndefined();

    const { mockWrite } = getDbMocks();
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });
});
