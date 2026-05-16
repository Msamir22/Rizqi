/**
 * Unit tests for the Supabase <-> WatermelonDB sync adapter.
 *
 * These tests cover the failure semantics that protect WatermelonDB's sync
 * cursor. A failed pull or push must reject the sync so WatermelonDB does not
 * treat missing remote data as a successful empty changeset.
 */

const mockSynchronize = jest.fn();
const mockGetCurrentUserId = jest.fn();
const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateIn = jest.fn();
const mockUpdateScopedIn = jest.fn();
const mockUpdateEq = jest.fn();
const mockWatermelonWhere = jest.fn((column: string, value: unknown) => ({
  column,
  value,
}));
const mockWatermelonNotEq = jest.fn((value: unknown) => ({ notEq: value }));
const mockForeignProfilesFetch = jest.fn();
const mockProfileQuery = jest.fn();
const mockDatabaseGet = jest.fn();
const mockDatabaseWrite = jest.fn();

interface SupabaseError {
  readonly message: string;
}

interface SupabaseResult {
  readonly data: ReadonlyArray<Record<string, unknown>> | null;
  readonly error: SupabaseError | null;
}

let selectResult: SupabaseResult = { data: [], error: null };

jest.mock("@monyvi/db", () => ({
  schema: {
    tables: {
      asset_metals: {},
      profiles: {},
      transactions: {},
      transfers: {},
    },
  },
}));

jest.mock("@nozbe/watermelondb/sync", () => ({
  synchronize: (args: unknown): Promise<unknown> =>
    mockSynchronize(args) as Promise<unknown>,
}));

jest.mock("@nozbe/watermelondb", () => ({
  Q: {
    notEq: (value: unknown): unknown => mockWatermelonNotEq(value),
    where: (column: string, value: unknown): unknown =>
      mockWatermelonWhere(column, value),
  },
}));

jest.mock("@/services/supabase", () => ({
  getCurrentUserId: (): Promise<string | null> =>
    mockGetCurrentUserId() as Promise<string | null>,
  supabase: {
    from: (table: string): unknown => mockFrom(table),
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { syncDatabase } from "../../services/sync";

function makeSelectChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    or: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve(selectResult)),
    in: jest.fn(() => Promise.resolve(selectResult)),
    then: (
      resolve: (value: SupabaseResult) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(selectResult).then(resolve, reject),
  };

  return chain;
}

function mockSupabaseTable(): void {
  mockFrom.mockImplementation(() => ({
    ...makeSelectChain(),
    insert: mockInsert,
    upsert: mockUpsert,
    update: mockUpdate,
  }));
  mockUpdate.mockReturnValue({ eq: mockUpdateEq, in: mockUpdateScopedIn });
  mockUpdateScopedIn.mockReturnValue({ in: mockUpdateIn });
  mockUpdateEq.mockReturnValue({ in: mockUpdateIn });
}

const mockDatabaseStub = {
  get: mockDatabaseGet,
  write: mockDatabaseWrite,
};
const mockDatabase = mockDatabaseStub as never;

beforeEach(() => {
  jest.clearAllMocks();
  selectResult = { data: [], error: null };
  mockGetCurrentUserId.mockResolvedValue("current-user");
  mockSupabaseTable();
  mockForeignProfilesFetch.mockResolvedValue([]);
  mockProfileQuery.mockReturnValue({ fetch: mockForeignProfilesFetch });
  mockDatabaseGet.mockReturnValue({ query: mockProfileQuery });
  mockDatabaseWrite.mockImplementation(async (writer: () => Promise<void>) => {
    await writer();
  });
});

describe("syncDatabase", () => {
  it("rejects pull table errors instead of returning a successful empty pull", async () => {
    selectResult = {
      data: null,
      error: { message: "profiles pull failed" },
    };
    mockSynchronize.mockImplementation(
      async (args: {
        pullChanges: (input: {
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pullChanges({ lastPulledAt: null });
      }
    );

    await expect(syncDatabase(mockDatabase, true)).rejects.toThrow(
      "profiles pull failed"
    );
  });

  it("rejects push insert errors so WatermelonDB keeps the local change dirty", async () => {
    mockInsert.mockResolvedValue({ error: { message: "insert failed" } });
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            profiles: {
              created: [{ id: "profile-1", user_id: "current-user" }],
              updated: [],
              deleted: [],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).rejects.toThrow("insert failed");
  });

  it("rejects push upsert errors so WatermelonDB keeps the local update dirty", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "upsert failed" } });
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            profiles: {
              created: [],
              updated: [{ id: "profile-1", user_id: "current-user" }],
              deleted: [],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).rejects.toThrow("upsert failed");
  });

  it("rejects push soft-delete errors so WatermelonDB keeps the delete dirty", async () => {
    mockUpdateIn.mockResolvedValue({ error: { message: "delete failed" } });
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            profiles: {
              created: [],
              updated: [],
              deleted: ["profile-1"],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).rejects.toThrow("delete failed");
  });

  it("rejects foreign dirty rows instead of pushing them as the authenticated user", async () => {
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            profiles: {
              created: [],
              updated: [{ id: "profile-1", user_id: "previous-user" }],
              deleted: [],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).rejects.toThrow(
      "Refusing to sync foreign local changes"
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("scopes child-table deletes through current-user parents even when the parent is soft-deleted", async () => {
    mockForeignProfilesFetch.mockResolvedValue([
      { id: "asset-1", user_id: "current-user", deleted: true },
    ]);
    mockUpdateIn.mockResolvedValue({ error: null });
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            asset_metals: {
              created: [],
              updated: [],
              deleted: ["metal-1"],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).resolves.toBeUndefined();

    expect(mockDatabaseGet).toHaveBeenCalledWith("assets");
    expect(mockWatermelonWhere).toHaveBeenCalledWith("user_id", "current-user");
    expect(mockWatermelonWhere).not.toHaveBeenCalledWith("deleted", false);
    expect(mockUpdateScopedIn).toHaveBeenCalledWith("asset_id", ["asset-1"]);
    expect(mockUpdateIn).toHaveBeenCalledWith("id", ["metal-1"]);
  });

  it("rejects child-table inserts when the parent is foreign", async () => {
    mockForeignProfilesFetch.mockResolvedValue([
      { id: "asset-current", user_id: "current-user", deleted: false },
    ]);
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            asset_metals: {
              created: [{ id: "metal-1", asset_id: "asset-foreign" }],
              updated: [],
              deleted: [],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).rejects.toThrow(
      "Refusing to sync foreign local changes"
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects child-table inserts when the parent is soft-deleted", async () => {
    mockForeignProfilesFetch.mockResolvedValue([]);
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            asset_metals: {
              created: [{ id: "metal-1", asset_id: "asset-deleted" }],
              updated: [],
              deleted: [],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).rejects.toThrow(
      "Refusing to sync foreign local changes"
    );
    expect(mockWatermelonWhere).toHaveBeenCalledWith("deleted", false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects child-table updates when parent lookup fails", async () => {
    mockForeignProfilesFetch.mockRejectedValue(
      new Error("parent lookup failed")
    );
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            asset_metals: {
              created: [],
              updated: [{ id: "metal-1", asset_id: "asset-1" }],
              deleted: [],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).rejects.toThrow(
      "parent lookup failed"
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("pushes SMS-created transactions with sms_fingerprint and without the old sms_body_hash field", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            transactions: {
              created: [
                {
                  id: "transaction-1",
                  user_id: "current-user",
                  amount: 850,
                  type: "EXPENSE",
                  date: Date.UTC(2026, 0, 15),
                  created_at: Date.UTC(2026, 0, 15, 10),
                  updated_at: Date.UTC(2026, 0, 15, 10),
                  sms_fingerprint: "sms-fingerprint-transaction-1",
                  sms_body_hash: "legacy-hash-should-not-sync",
                },
              ],
              updated: [],
              deleted: [],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith("transactions");
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "transaction-1",
        user_id: "current-user",
        sms_fingerprint: "sms-fingerprint-transaction-1",
        date: "2026-01-15",
        created_at: "2026-01-15T10:00:00.000Z",
        updated_at: "2026-01-15T10:00:00.000Z",
      }),
    ]);

    const insertCalls: ReadonlyArray<
      readonly [ReadonlyArray<Record<string, unknown>>]
    > = mockInsert.mock.calls;
    const [insertedRows] = insertCalls[0];
    const [insertedRow] = insertedRows;
    expect(insertedRow).not.toHaveProperty("sms_body_hash");
  });

  it("pushes SMS-created transfers with sms_fingerprint and without the old sms_body_hash field", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockSynchronize.mockImplementation(
      async (args: {
        pushChanges: (input: {
          changes: Record<string, unknown>;
          lastPulledAt: number | null;
        }) => Promise<unknown>;
      }) => {
        await args.pushChanges({
          changes: {
            transfers: {
              created: [
                {
                  id: "transfer-1",
                  user_id: "current-user",
                  from_account_id: "cash-account",
                  to_account_id: "bank-account",
                  amount: 1000,
                  date: Date.UTC(2026, 0, 16),
                  created_at: Date.UTC(2026, 0, 16, 12),
                  updated_at: Date.UTC(2026, 0, 16, 12),
                  sms_fingerprint: "sms-fingerprint-transfer-1",
                  sms_body_hash: "legacy-transfer-hash-should-not-sync",
                },
              ],
              updated: [],
              deleted: [],
            },
          },
          lastPulledAt: null,
        });
      }
    );

    await expect(syncDatabase(mockDatabase)).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith("transfers");
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "transfer-1",
        user_id: "current-user",
        sms_fingerprint: "sms-fingerprint-transfer-1",
        date: "2026-01-16",
        created_at: "2026-01-16T12:00:00.000Z",
        updated_at: "2026-01-16T12:00:00.000Z",
      }),
    ]);

    const insertCalls: ReadonlyArray<
      readonly [ReadonlyArray<Record<string, unknown>>]
    > = mockInsert.mock.calls;
    const [insertedRows] = insertCalls[0];
    const [insertedRow] = insertedRows;
    expect(insertedRow).not.toHaveProperty("sms_body_hash");
  });
});
