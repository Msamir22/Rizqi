import { renderHook } from "@testing-library/react-native";

interface MockObserver<T> {
  readonly next: (result: readonly T[]) => void;
  readonly error: (err: unknown) => void;
}

interface MockObservable<T> {
  readonly subscribe: jest.Mock<{ unsubscribe: jest.Mock }, [MockObserver<T>]>;
}

const mockAccountsObserveWithColumns = jest.fn();
const mockAssetMetalsObserve = jest.fn();
const mockAssetsObserveWithColumns = jest.fn();
const mockQueryChildrenOfOwnedParents = jest.fn<unknown, unknown[]>(
  () => mockAssetMetalsQuery
);
const mockAccountsQuery = {
  observeWithColumns: mockAccountsObserveWithColumns,
};
const mockAssetsQuery = {
  observeWithColumns: mockAssetsObserveWithColumns,
};
const mockAssetMetalsQuery = {
  observe: mockAssetMetalsObserve,
};
const mockAccountsCollection = {
  query: jest.fn(() => mockAccountsQuery),
};
const mockAssetMetalsCollection = {
  query: jest.fn(() => mockAssetMetalsQuery),
};
const mockAssetsCollection = {
  query: jest.fn(() => mockAssetsQuery),
};
const mockDatabaseGet = jest.fn((collectionName: string) => {
  if (collectionName === "accounts") return mockAccountsCollection;
  if (collectionName === "assets") return mockAssetsCollection;
  if (collectionName === "asset_metals") return mockAssetMetalsCollection;
  throw new Error(`Unexpected collection: ${collectionName}`);
});
const mockQueryOwned = jest.fn<unknown, unknown[]>((collection) => {
  if (collection === mockAssetsCollection) return mockAssetsQuery;
  return mockAccountsQuery;
});

jest.mock("@monyvi/db", () => ({
  database: {
    get: (collectionName: string): unknown => mockDatabaseGet(collectionName),
  },
}));

jest.mock("@nozbe/watermelondb", () => ({
  Q: {
    desc: "desc",
    oneOf: (...args: readonly unknown[]) => ({ kind: "oneOf", args }),
    sortBy: (...args: readonly unknown[]) => ({ kind: "sortBy", args }),
    where: (...args: readonly unknown[]) => ({ kind: "where", args }),
  },
}));

jest.mock("@/services/user-data-access", () => ({
  queryChildrenOfOwnedParents: (...args: readonly unknown[]): unknown =>
    mockQueryChildrenOfOwnedParents(args),
  queryOwned: (...args: readonly unknown[]): unknown => mockQueryOwned(...args),
}));

jest.mock("@monyvi/logic", () => ({
  calculateAccountsTotalBalance: jest.fn(() => 0),
  calculateNetWorth: jest.fn((totalAccounts: number, totalAssets: number) => ({
    totalAccounts,
    totalAssets,
    totalNetWorth: totalAccounts + totalAssets,
  })),
  calculateTotalAssets: jest.fn(() => 0),
  convertCurrency: jest.fn((amount: number) => amount),
  getSameDayLastMonth: jest.fn(() => new Date("2025-12-01T00:00:00Z")),
}));

jest.mock("../../hooks/useMarketRates", () => ({
  useMarketRates: (): { latestRates: object; isLoading: boolean } => ({
    latestRates: {},
    isLoading: false,
  }),
}));

jest.mock("../../hooks/usePreferredCurrency", () => ({
  usePreferredCurrency: (): { preferredCurrency: "USD" } => ({
    preferredCurrency: "USD",
  }),
}));

jest.mock("../../hooks/useCurrentUserId", () => ({
  useCurrentUserId: (): { userId: string; isResolvingUser: boolean } => ({
    userId: "user-1",
    isResolvingUser: false,
  }),
  runUserScopedEffect: ({
    userId,
    isResolvingUser,
    onResolving,
    onSignedOut,
    onAuthenticated,
  }: {
    readonly userId: string | null;
    readonly isResolvingUser: boolean;
    readonly onResolving: () => void;
    readonly onSignedOut: () => void;
    readonly onAuthenticated: (userId: string) => void | (() => void);
  }): void | (() => void) => {
    if (isResolvingUser) {
      onResolving();
      return;
    }
    if (!userId) {
      onSignedOut();
      return;
    }
    return onAuthenticated(userId);
  },
}));

// eslint-disable-next-line import/first
import { useNetWorth } from "../../hooks/useNetWorth";

function buildObservable<T>(): MockObservable<T> {
  return {
    subscribe: jest.fn((observer: MockObserver<T>) => {
      void observer;
      return { unsubscribe: jest.fn() };
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountsObserveWithColumns.mockReturnValue(buildObservable());
  mockAssetMetalsObserve.mockReturnValue(buildObservable());
  mockAssetsObserveWithColumns.mockReturnValue(buildObservable());
});

describe("useNetWorth", () => {
  it("scopes account and asset reads to the current user", () => {
    const { unmount } = renderHook(() => useNetWorth());

    expect(mockQueryOwned).toHaveBeenCalledWith(
      mockAccountsCollection,
      "user-1",
      { kind: "where", args: ["deleted", false] }
    );
    expect(mockQueryOwned).toHaveBeenCalledWith(
      mockAssetsCollection,
      "user-1",
      { kind: "where", args: ["deleted", false] }
    );

    unmount();
  });
});
