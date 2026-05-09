/**
 * user-data-access.test.ts
 *
 * Tests for the runtime user-scoped data guard used as defense-in-depth
 * around local WatermelonDB reads and writes.
 */

interface MockUserOwnedRecord {
  readonly id: string;
  readonly userId: string;
}

interface MockCategoryRecord {
  readonly id: string;
  readonly userId?: string | null;
}

interface MockChildRecord {
  readonly id: string;
  readonly accountId: string;
}

interface MockCollection<T> {
  readonly find: jest.Mock<Promise<T>, [string]>;
}

const mockGetCurrentUserId = jest.fn<Promise<string | null>, []>();

jest.mock("@/services/supabase", () => ({
  getCurrentUserId: (): Promise<string | null> => mockGetCurrentUserId(),
}));

import {
  USER_DATA_ACCESS_ERROR_CODES,
  assertAccessibleCategory,
  assertChildRecordParentOwned,
  assertOwnedRecord,
  findOwnedById,
  getCurrentUserDataScope,
  getRequiredCurrentUserId,
  queryChildrenOfOwnedParent,
} from "@/services/user-data-access";

describe("user-data-access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fails closed when no authenticated user exists", async () => {
    mockGetCurrentUserId.mockResolvedValueOnce(null);

    await expect(getRequiredCurrentUserId()).rejects.toThrow(
      USER_DATA_ACCESS_ERROR_CODES.USER_REQUIRED
    );
  });

  it("allows owned records", () => {
    const record: MockUserOwnedRecord = { id: "acc-1", userId: "user-1" };

    expect(assertOwnedRecord(record, "user-1")).toBe(record);
  });

  it("denies foreign user-owned records", () => {
    const record: MockUserOwnedRecord = { id: "acc-1", userId: "owner-user" };

    expect(() => assertOwnedRecord(record, "attacker-user")).toThrow(
      USER_DATA_ACCESS_ERROR_CODES.OWNERSHIP_FAILED
    );
  });

  it("loads by id and denies foreign records", async () => {
    const collection: MockCollection<MockUserOwnedRecord> = {
      find: jest.fn((_id: string) =>
        Promise.resolve({ id: "acc-1", userId: "owner-user" })
      ),
    };

    await expect(
      findOwnedById(collection, "acc-1", "attacker-user")
    ).rejects.toThrow(USER_DATA_ACCESS_ERROR_CODES.OWNERSHIP_FAILED);
  });

  it("creates a bound current-user scope for repeated owned reads", async () => {
    mockGetCurrentUserId.mockResolvedValueOnce(" user-1 ");
    const collection: MockCollection<MockUserOwnedRecord> = {
      find: jest.fn((id: string) => Promise.resolve({ id, userId: "user-1" })),
    };

    const scope = await getCurrentUserDataScope();
    const record = await scope.findOwned(collection, "acc-1");
    const secondRecord = await scope.findOwned(collection, "acc-2");

    expect(scope.userId).toBe("user-1");
    expect(record.id).toBe("acc-1");
    expect(secondRecord.id).toBe("acc-2");
    expect(collection.find).toHaveBeenCalledTimes(2);
    expect(mockGetCurrentUserId).toHaveBeenCalledTimes(1);
  });

  it("scope denies foreign owned records", async () => {
    mockGetCurrentUserId.mockResolvedValueOnce("attacker-user");
    const collection: MockCollection<MockUserOwnedRecord> = {
      find: jest.fn((_id: string) =>
        Promise.resolve({ id: "acc-1", userId: "owner-user" })
      ),
    };

    const scope = await getCurrentUserDataScope();

    await expect(scope.findOwned(collection, "acc-1")).rejects.toThrow(
      USER_DATA_ACCESS_ERROR_CODES.OWNERSHIP_FAILED
    );
  });

  it("queries children through a verified owned parent", () => {
    const query = jest.fn();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const collection = { query } as never;
    const parent = { id: "acc-1", userId: "user-1" };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const condition = { column: "deleted", value: false } as never;

    queryChildrenOfOwnedParent(
      collection,
      parent,
      "user-1",
      "account_id",
      condition
    );

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("allows system categories for any signed-in user", () => {
    const systemCategory: MockCategoryRecord = {
      id: "cat-system",
      userId: null,
    };

    expect(assertAccessibleCategory(systemCategory, "user-1")).toBe(
      systemCategory
    );
  });

  it("denies foreign custom categories", () => {
    const customCategory: MockCategoryRecord = {
      id: "cat-custom",
      userId: "owner-user",
    };

    expect(() =>
      assertAccessibleCategory(customCategory, "attacker-user")
    ).toThrow(USER_DATA_ACCESS_ERROR_CODES.OWNERSHIP_FAILED);
  });

  it("allows child records only when their parent is owned", async () => {
    const child: MockChildRecord = { id: "bd-1", accountId: "acc-1" };
    const parents: MockCollection<MockUserOwnedRecord> = {
      find: jest.fn((_id: string) =>
        Promise.resolve({ id: "acc-1", userId: "user-1" })
      ),
    };

    await expect(
      assertChildRecordParentOwned(child, parents, "accountId", "user-1")
    ).resolves.toBe(child);
  });

  it("denies child records when their parent is foreign", async () => {
    const child: MockChildRecord = { id: "bd-1", accountId: "acc-1" };
    const parents: MockCollection<MockUserOwnedRecord> = {
      find: jest.fn((_id: string) =>
        Promise.resolve({ id: "acc-1", userId: "owner-user" })
      ),
    };

    await expect(
      assertChildRecordParentOwned(child, parents, "accountId", "attacker-user")
    ).rejects.toThrow(USER_DATA_ACCESS_ERROR_CODES.OWNERSHIP_FAILED);
  });
});
