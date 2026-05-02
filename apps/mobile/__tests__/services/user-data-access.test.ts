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
  getRequiredCurrentUserId,
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
