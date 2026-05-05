interface MockQuery {
  readonly fetchCount: jest.Mock<Promise<number>, []>;
}

interface MockCollection {
  readonly query: jest.Mock<MockQuery, unknown[]>;
}

let mockFetchCounts: number[] = [];
const mockQuery = jest.fn<MockQuery, unknown[]>();
const mockGet = jest.fn<MockCollection, [string]>();

jest.mock("@monyvi/db", () => ({
  database: {
    get: (tableName: string) => mockGet(tableName),
  },
}));

jest.mock("@nozbe/watermelondb", () => ({
  Q: {
    notEq: jest.fn((value: unknown) => ({ notEq: value })),
    where: jest.fn((field: string, value: unknown) => ({ field, value })),
  },
}));

import { hasExistingSmsBodyHash } from "@/services/sms-dedup-service";

describe("sms-dedup-service", () => {
  beforeEach(() => {
    mockFetchCounts = [];
    mockQuery.mockReset();
    mockQuery.mockImplementation(() => ({
      fetchCount: jest.fn(() => Promise.resolve(mockFetchCounts.shift() ?? 0)),
    }));
    mockGet.mockReset();
    mockGet.mockImplementation(() => ({
      query: mockQuery,
    }));
  });

  it("returns false when the SMS hash is not found in transactions or transfers", async () => {
    mockFetchCounts = [0, 0];

    await expect(hasExistingSmsBodyHash("hash-1")).resolves.toBe(false);
  });

  it("returns true when the SMS hash already exists in transactions", async () => {
    mockFetchCounts = [1, 0];

    await expect(hasExistingSmsBodyHash("hash-1")).resolves.toBe(true);
  });

  it("returns true when the SMS hash already exists in transfers", async () => {
    mockFetchCounts = [0, 1];

    await expect(hasExistingSmsBodyHash("hash-1")).resolves.toBe(true);
  });
});
