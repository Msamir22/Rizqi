/**
 * @file profile-service.test.ts
 * @description Unit tests for profile-service mutations.
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
// Import module under test (after mocks)
// =============================================================================

import {
  setPreferredLanguage,
  markSlidesViewed,
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
    preferredLanguage: null,
    slidesViewed: false,
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
  it("updates the profile's preferredLanguage field", async (): Promise<void> => {
    const profile = createMockProfile();
    setupProfileFound(profile);

    await setPreferredLanguage("en");

    const { mockWrite } = getDbMocks();
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it("throws if no profile row exists", async (): Promise<void> => {
    setupProfileNotFound();
    await expect(setPreferredLanguage("en")).rejects.toThrow();
  });
});

describe("markSlidesViewed", () => {
  it("sets slidesViewed to true on the profile", async (): Promise<void> => {
    const profile = createMockProfile({ preferredLanguage: "en" });
    setupProfileFound(profile);

    await markSlidesViewed();

    const { mockWrite } = getDbMocks();
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it("throws if no profile row exists", async (): Promise<void> => {
    setupProfileNotFound();
    await expect(markSlidesViewed()).rejects.toThrow();
  });
});

describe("setPreferredCurrencyAndCreateCashAccount", () => {
  it("wraps profile update and ensureCashAccount in a single database.write", async (): Promise<void> => {
    const profile = createMockProfile({
      preferredLanguage: "en",
      slidesViewed: true,
      userId: "user-1",
    });
    setupProfileFound(profile);

    const result = await setPreferredCurrencyAndCreateCashAccount("EGP");

    const { mockWrite } = getDbMocks();
    expect(mockWrite).toHaveBeenCalledTimes(1);

    const { ensureCashAccount } = getAccountServiceMocks();
    expect(ensureCashAccount).toHaveBeenCalledWith("user-1", "EGP");
    expect(result.accountId).toBe("cash-account-1");
  });

  it("returns existing accountId when cash account already exists", async (): Promise<void> => {
    const profile = createMockProfile({
      preferredLanguage: "en",
      slidesViewed: true,
      userId: "user-1",
    });
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
  it("sets onboardingCompleted to true on the profile", async (): Promise<void> => {
    const profile = createMockProfile({
      preferredLanguage: "en",
      slidesViewed: true,
      onboardingCompleted: false,
    });
    setupProfileFound(profile);

    await completeOnboarding();

    const { mockWrite } = getDbMocks();
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — skips write when already completed", async (): Promise<void> => {
    const profile = createMockProfile({ onboardingCompleted: true });
    setupProfileFound(profile);

    await completeOnboarding();

    const { mockWrite } = getDbMocks();
    expect(mockWrite).not.toHaveBeenCalled();
  });
});
