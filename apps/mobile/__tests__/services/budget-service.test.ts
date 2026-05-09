const mockWrite = jest.fn();
const mockGet = jest.fn();
const mockCreateBudget = jest.fn();
const mockWhere = jest.fn();
const mockAnd = jest.fn();
const mockFindAccessibleCategory = jest.fn();
const mockQueryOwned = jest.fn();
const mockGetCurrentUserDataScope = jest.fn();

interface MockQueryResult<TRecord> {
  readonly fetch: () => Promise<TRecord[]>;
  readonly fetchCount: () => Promise<number>;
}

interface MockUserDataScope {
  readonly userId: string;
  readonly findAccessibleCategory: typeof mockFindAccessibleCategory;
  readonly queryOwned: typeof mockQueryOwned;
}

interface MockBudgetRecord {
  readonly id: string;
  readonly userId: string;
  readonly type: string;
  categoryId: string;
  readonly period: string;
  readonly update: jest.Mock<
    Promise<void>,
    [(record: MockBudgetRecord) => void]
  >;
}

function createQueryResult<TRecord>(
  records: readonly TRecord[],
  count = 0
): MockQueryResult<TRecord> {
  return {
    fetch: (): Promise<TRecord[]> => Promise.resolve([...records]),
    fetchCount: (): Promise<number> => Promise.resolve(count),
  };
}

function createExistingCategoryBudget(): MockBudgetRecord {
  const existingBudget: MockBudgetRecord = {
    id: "budget-1",
    userId: "user-1",
    type: "CATEGORY",
    categoryId: "category-old",
    period: "MONTHLY",
    update: jest.fn(
      (builder: (record: MockBudgetRecord) => void): Promise<void> => {
        builder(existingBudget);
        return Promise.resolve();
      }
    ),
  };

  return existingBudget;
}

jest.mock("@monyvi/db", (): unknown => ({
  database: {
    write: (...args: unknown[]): Promise<unknown> =>
      mockWrite(...args) as Promise<unknown>,
    get: (tableName: string): unknown => mockGet(tableName),
  },
  Q: {
    where: (...args: unknown[]): unknown => mockWhere(...args),
    and: (...args: unknown[]): unknown => mockAnd(...args),
    notEq: (value: unknown): unknown => ({ operator: "notEq", value }),
  },
}));

jest.mock("@/services/user-data-access", (): unknown => ({
  getCurrentUserDataScope: (): Promise<unknown> => {
    const scope = mockGetCurrentUserDataScope() as Promise<unknown>;
    return scope;
  },
}));

import { createBudget, updateBudget } from "@/services/budget-service";

describe("budget-service", () => {
  beforeEach((): void => {
    jest.clearAllMocks();
    mockWrite.mockImplementation(
      async (callback: () => Promise<unknown>): Promise<unknown> => callback()
    );
    mockCreateBudget.mockImplementation(
      (
        builder: (record: Record<string, unknown>) => void
      ): Promise<Record<string, unknown>> => {
        const budget: Record<string, unknown> = {};
        builder(budget);
        return Promise.resolve(budget);
      }
    );
    mockGet.mockImplementation((tableName: string): unknown => {
      if (tableName === "budgets") {
        return { create: mockCreateBudget };
      }
      return {};
    });
    mockWhere.mockImplementation((column: string, value: unknown): unknown => ({
      column,
      value,
    }));
    mockAnd.mockImplementation(
      (...conditions: readonly unknown[]): unknown => ({
        conditions,
      })
    );
    mockFindAccessibleCategory.mockResolvedValue({ id: "category-resolved" });
    mockQueryOwned.mockReturnValue(createQueryResult<MockBudgetRecord>([]));
    const scope: MockUserDataScope = {
      userId: "user-1",
      findAccessibleCategory: mockFindAccessibleCategory,
      queryOwned: mockQueryOwned,
    };
    mockGetCurrentUserDataScope.mockResolvedValue(scope);
  });

  it("resolves a category budget category through the current user scope before create", async (): Promise<void> => {
    const budget = await createBudget({
      name: "Food",
      type: "CATEGORY",
      categoryId: "category-input",
      amount: 1000,
      period: "MONTHLY",
      alertThreshold: 80,
    });

    expect(mockFindAccessibleCategory).toHaveBeenCalledWith(
      expect.anything(),
      "category-input"
    );
    expect(mockFindAccessibleCategory.mock.invocationCallOrder[0]).toBeLessThan(
      mockQueryOwned.mock.invocationCallOrder[0]
    );
    expect(budget).toMatchObject({
      userId: "user-1",
      type: "CATEGORY",
      categoryId: "category-resolved",
    });
  });

  it("does not create a category budget when category resolution fails", async (): Promise<void> => {
    mockFindAccessibleCategory.mockRejectedValueOnce(
      new Error("category inaccessible")
    );

    await expect(
      createBudget({
        name: "Food",
        type: "CATEGORY",
        categoryId: "category-input",
        amount: 1000,
        period: "MONTHLY",
        alertThreshold: 80,
      })
    ).rejects.toThrow("category inaccessible");

    expect(mockFindAccessibleCategory).toHaveBeenCalledWith(
      expect.anything(),
      "category-input"
    );
    expect(mockQueryOwned).not.toHaveBeenCalled();
    expect(mockCreateBudget).not.toHaveBeenCalled();
  });

  it("does not create a category budget when category resolution returns no category", async (): Promise<void> => {
    mockFindAccessibleCategory.mockResolvedValueOnce(null);

    await expect(
      createBudget({
        name: "Food",
        type: "CATEGORY",
        categoryId: "category-input",
        amount: 1000,
        period: "MONTHLY",
        alertThreshold: 80,
      })
    ).rejects.toThrow();

    expect(mockQueryOwned).not.toHaveBeenCalled();
    expect(mockCreateBudget).not.toHaveBeenCalled();
  });

  it("resolves a replacement category through the current user scope before update", async (): Promise<void> => {
    const existingBudget = createExistingCategoryBudget();
    mockQueryOwned
      .mockReturnValueOnce(createQueryResult([existingBudget]))
      .mockReturnValue(createQueryResult<MockBudgetRecord>([]));

    await updateBudget("budget-1", { categoryId: "category-new" });

    expect(mockFindAccessibleCategory).toHaveBeenCalledWith(
      expect.anything(),
      "category-new"
    );
    expect(existingBudget.update).toHaveBeenCalledTimes(1);
    expect(existingBudget.categoryId).toBe("category-resolved");
  });

  it("does not update a budget when replacement category resolution fails", async (): Promise<void> => {
    const existingBudget = createExistingCategoryBudget();
    mockQueryOwned.mockReturnValueOnce(createQueryResult([existingBudget]));
    mockFindAccessibleCategory.mockRejectedValueOnce(
      new Error("category inaccessible")
    );

    await expect(
      updateBudget("budget-1", { categoryId: "category-new" })
    ).rejects.toThrow("category inaccessible");

    expect(mockFindAccessibleCategory).toHaveBeenCalledWith(
      expect.anything(),
      "category-new"
    );
    expect(existingBudget.update).not.toHaveBeenCalled();
    expect(mockQueryOwned).toHaveBeenCalledTimes(1);
  });

  it("does not update a budget when replacement category resolution returns no category", async (): Promise<void> => {
    const existingBudget = createExistingCategoryBudget();
    mockQueryOwned.mockReturnValueOnce(createQueryResult([existingBudget]));
    mockFindAccessibleCategory.mockResolvedValueOnce(null);

    await expect(
      updateBudget("budget-1", { categoryId: "category-new" })
    ).rejects.toThrow();

    expect(existingBudget.update).not.toHaveBeenCalled();
    expect(mockQueryOwned).toHaveBeenCalledTimes(1);
  });
});
