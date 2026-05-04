/**
 * transaction-service.test.ts — T027
 *
 * Tests all exported functions from transaction-service.ts:
 * - createTransaction
 * - updateTransaction
 * - deleteTransaction
 * - convertTransactionToTransfer
 * - batchDeleteDisplayTransactions
 *
 * Mock Strategy:
 *   The `@monyvi/db` mock is defined entirely inside the jest.mock factory
 *   to avoid Jest hoisting issues. All helpers are exposed as `__`-prefixed
 *   properties and accessed via `jest.requireMock()`.
 */

// ---------------------------------------------------------------------------
// Shared Mock Types
// ---------------------------------------------------------------------------

interface MockModelRecord {
  readonly id: string;
  [key: string]: unknown;
  update: jest.Mock;
  prepareUpdate: jest.Mock;
}

interface MockDbApi {
  readonly __mockDb: {
    write: jest.Mock;
    get: jest.Mock;
    batch: jest.Mock;
  };
  readonly __model: (
    id: string,
    fields?: Record<string, unknown>
  ) => MockModelRecord;
  readonly __seed: (table: string, model: MockModelRecord) => void;
  readonly __clearStores: () => void;
  readonly __rewireMocks: () => void;
}

// ---------------------------------------------------------------------------
// jest.mock declarations — factory is hoisted, so everything must be inline
// ---------------------------------------------------------------------------

jest.mock("@monyvi/db", () => {
  /** Mutable model: .update(builder) mutates fields in place */
  function createModel(
    id: string,
    fields: Record<string, unknown> = {}
  ): MockModelRecord {
    const m: Record<string, unknown> = { id, ...fields };
    m.update = jest.fn((builder: (r: Record<string, unknown>) => void) => {
      builder(m);
      return Promise.resolve(m);
    });
    m.prepareUpdate = jest.fn(
      (builder: (r: Record<string, unknown>) => void) => {
        builder(m);
        return m;
      }
    );
    return m as MockModelRecord;
  }

  const stores: Record<string, Map<string, MockModelRecord>> = {};

  function getStore(t: string): Map<string, MockModelRecord> {
    if (!stores[t]) stores[t] = new Map();
    return stores[t];
  }

  function createCollection(tableName: string): Record<string, jest.Mock> {
    return {
      find: jest.fn((id: string) => {
        const m = getStore(tableName).get(id);
        if (!m)
          return Promise.reject(new Error(`Not found: ${id} in ${tableName}`));
        return Promise.resolve(m);
      }),
      create: jest.fn((builder: (r: Record<string, unknown>) => void) => {
        const m = createModel(`new-${tableName}-${Date.now()}`);
        builder(m);
        getStore(tableName).set(m.id, m);
        return Promise.resolve(m);
      }),
      query: jest.fn(() => ({
        fetch: jest.fn(() =>
          Promise.resolve(Array.from(getStore(tableName).values()))
        ),
      })),
    };
  }

  const db = {
    write: jest.fn((cb: () => Promise<unknown>) => cb()),
    get: jest.fn((t: string) => createCollection(t)),
    batch: jest.fn(),
  };

  return {
    database: db,
    Q: {
      where: jest.fn((_f: string, c: unknown) => c),
      oneOf: jest.fn((ids: string[]) => ids),
    },
    __mockDb: db,
    __stores: stores,
    __model: createModel,
    __seed: (table: string, model: MockModelRecord) => {
      getStore(table).set(model.id, model);
    },
    __clearStores: () => {
      for (const key of Object.keys(stores)) stores[key].clear();
    },
    __rewireMocks: () => {
      db.write.mockImplementation((cb: () => Promise<unknown>) => cb());
      db.get.mockImplementation((t: string) => createCollection(t));
    },
  };
});

jest.mock("@/services/supabase", () => ({
  getCurrentUserId: jest.fn(() => Promise.resolve("test-user-id")),
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  convertTransactionToTransfer,
  batchDeleteDisplayTransactions,
} from "@/services/transaction-service";

import type { DisplayTransaction } from "@/hooks/useTransactionsGrouping";

// ---------------------------------------------------------------------------
// Grab mock helpers (typed via MockDbApi)
// ---------------------------------------------------------------------------

const {
  __mockDb: mockDb,
  __model: mockModel,
  __seed: mockSeed,
  __clearStores: mockClearStores,
  __rewireMocks: mockRewire,
} = jest.requireMock<MockDbApi>("@monyvi/db");

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function seedAccount(id: string, balance: number): MockModelRecord {
  const acc = mockModel(id, { balance });
  mockSeed("accounts", acc);
  return acc;
}

function seedTx(
  id: string,
  overrides: Record<string, unknown> = {}
): MockModelRecord {
  const defaults: Record<string, unknown> = {
    userId: "test-user-id",
    accountId: "acc-1",
    amount: 100,
    currency: "EGP",
    type: "EXPENSE",
    categoryId: "cat-1",
    counterparty: undefined,
    note: undefined,
    date: new Date("2026-01-01"),
    source: "MANUAL",
    linkedRecurringId: undefined,
    isDraft: false,
    deleted: false,
  };
  const tx = mockModel(id, { ...defaults, ...overrides });
  mockSeed("transactions", tx);
  return tx;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("transaction-service", () => {
  beforeEach(() => {
    mockClearStores();
    mockDb.write.mockClear();
    mockDb.get.mockClear();
    mockDb.batch.mockClear();
    mockRewire();

    const supabaseMock = jest.requireMock<{ getCurrentUserId: jest.Mock }>(
      "@/services/supabase"
    );
    supabaseMock.getCurrentUserId.mockImplementation(() =>
      Promise.resolve("test-user-id")
    );
  });

  // =========================================================================
  // createTransaction
  // =========================================================================
  describe("createTransaction", () => {
    it("should decrease balance for EXPENSE", async () => {
      const acc = seedAccount("acc-1", 1000);
      await createTransaction({
        amount: 200,
        currency: "EGP",
        categoryId: "cat-food",
        accountId: "acc-1",
        type: "EXPENSE",
        source: "MANUAL",
      });
      expect(acc.balance).toBe(800);
    });

    it("should increase balance for INCOME", async () => {
      const acc = seedAccount("acc-1", 1000);
      await createTransaction({
        amount: 500,
        currency: "EGP",
        categoryId: "cat-salary",
        accountId: "acc-1",
        type: "INCOME",
        source: "MANUAL",
      });
      expect(acc.balance).toBe(1500);
    });

    it("should store absolute amount for negative input", async () => {
      seedAccount("acc-1", 1000);
      const result = await createTransaction({
        amount: -300,
        currency: "EGP",
        categoryId: "cat-1",
        accountId: "acc-1",
        type: "EXPENSE",
        source: "MANUAL",
      });
      expect(result.amount).toBe(300);
    });

    it("should persist the SMS body hash for SMS transactions", async () => {
      seedAccount("acc-1", 1000);
      const result = await createTransaction({
        amount: 125,
        currency: "EGP",
        categoryId: "cat-1",
        accountId: "acc-1",
        type: "EXPENSE",
        source: "SMS",
        smsBodyHash: "sms-hash-1",
      });

      expect(result.smsBodyHash).toBe("sms-hash-1");
    });

    it("should throw when user is not authenticated", async () => {
      const supabaseMock = jest.requireMock<{ getCurrentUserId: jest.Mock }>(
        "@/services/supabase"
      );
      supabaseMock.getCurrentUserId.mockResolvedValueOnce(null);
      seedAccount("acc-1", 1000);
      await expect(
        createTransaction({
          amount: 100,
          currency: "EGP",
          categoryId: "cat-1",
          accountId: "acc-1",
          type: "EXPENSE",
          source: "MANUAL",
        })
      ).rejects.toThrow("User not authenticated");
    });
  });

  // =========================================================================
  // updateTransaction
  // =========================================================================
  describe("updateTransaction", () => {
    it("should adjust balance when amount changes (EXPENSE)", async () => {
      const acc = seedAccount("acc-1", 900);
      seedTx("tx-1", { accountId: "acc-1", amount: 100, type: "EXPENSE" });
      await updateTransaction("tx-1", { amount: 300 });
      expect(acc.balance).toBe(700);
    });

    it("should adjust balance when amount changes (INCOME)", async () => {
      const acc = seedAccount("acc-1", 1100);
      seedTx("tx-1", { accountId: "acc-1", amount: 100, type: "INCOME" });
      await updateTransaction("tx-1", { amount: 500 });
      expect(acc.balance).toBe(1500);
    });

    it("should handle EXPENSE → INCOME type change", async () => {
      const acc = seedAccount("acc-1", 800);
      seedTx("tx-1", { accountId: "acc-1", amount: 200, type: "EXPENSE" });
      await updateTransaction("tx-1", { type: "INCOME" });
      expect(acc.balance).toBe(1200);
    });

    it("should handle INCOME → EXPENSE type change", async () => {
      const acc = seedAccount("acc-1", 1200);
      seedTx("tx-1", { accountId: "acc-1", amount: 200, type: "INCOME" });
      await updateTransaction("tx-1", { type: "EXPENSE" });
      expect(acc.balance).toBe(800);
    });

    it("should handle account swap (revert old, apply new)", async () => {
      const oldAcc = seedAccount("acc-1", 850);
      const newAcc = seedAccount("acc-2", 2000);
      seedTx("tx-1", { accountId: "acc-1", amount: 150, type: "EXPENSE" });
      await updateTransaction("tx-1", { accountId: "acc-2" });
      expect(oldAcc.balance).toBe(1000);
      expect(newAcc.balance).toBe(1850);
    });

    it("should update non-financial fields", async () => {
      seedAccount("acc-1", 1000);
      const tx = seedTx("tx-1", {
        accountId: "acc-1",
        amount: 100,
        type: "EXPENSE",
      });
      const d = new Date("2026-06-15");
      await updateTransaction("tx-1", {
        categoryId: "cat-new",
        note: "n",
        date: d,
        counterparty: "X",
      });
      expect(tx.categoryId).toBe("cat-new");
      expect(tx.note).toBe("n");
      expect(tx.date).toEqual(d);
      expect(tx.counterparty).toBe("X");
    });

    it("should skip balance adjustment for non-financial-only updates", async () => {
      const acc = seedAccount("acc-1", 900);
      seedTx("tx-1", { accountId: "acc-1", amount: 100, type: "EXPENSE" });
      await updateTransaction("tx-1", { note: "just a note" });
      expect(acc.balance).toBe(900);
    });
  });

  // =========================================================================
  // deleteTransaction
  // =========================================================================
  describe("deleteTransaction", () => {
    it("should revert EXPENSE balance and soft-delete", async () => {
      const acc = seedAccount("acc-1", 900);
      const tx = seedTx("tx-1", {
        accountId: "acc-1",
        amount: 100,
        type: "EXPENSE",
      });
      await deleteTransaction("tx-1");
      expect(acc.balance).toBe(1000);
      expect(tx.deleted).toBe(true);
    });

    it("should revert INCOME balance and soft-delete", async () => {
      const acc = seedAccount("acc-1", 1100);
      const tx = seedTx("tx-1", {
        accountId: "acc-1",
        amount: 100,
        type: "INCOME",
      });
      await deleteTransaction("tx-1");
      expect(acc.balance).toBe(1000);
      expect(tx.deleted).toBe(true);
    });
  });

  // =========================================================================
  // convertTransactionToTransfer
  // =========================================================================
  describe("convertTransactionToTransfer", () => {
    it("should soft-delete tx, create transfer, and adjust both accounts", async () => {
      const from = seedAccount("acc-from", 800);
      const to = seedAccount("acc-to", 500);
      const tx = seedTx("tx-1", {
        accountId: "acc-from",
        amount: 200,
        type: "EXPENSE",
        currency: "EGP",
        date: new Date("2026-03-01"),
        note: "lunch",
      });
      await convertTransactionToTransfer({
        transactionId: "tx-1",
        toAccountId: "acc-to",
        notes: "xfer",
      });
      expect(tx.deleted).toBe(true);
      expect(from.balance).toBe(800);
      expect(to.balance).toBe(700);
    });

    it("should throw when user is not authenticated", async () => {
      const supabaseMock = jest.requireMock<{ getCurrentUserId: jest.Mock }>(
        "@/services/supabase"
      );
      supabaseMock.getCurrentUserId.mockResolvedValueOnce(null);
      seedAccount("acc-from", 1000);
      seedTx("tx-1", { accountId: "acc-from" });
      await expect(
        convertTransactionToTransfer({
          transactionId: "tx-1",
          toAccountId: "acc-to",
        })
      ).rejects.toThrow("User not authenticated");
    });
  });

  // =========================================================================
  // batchDeleteDisplayTransactions
  // =========================================================================
  describe("batchDeleteDisplayTransactions", () => {
    it("should do nothing for empty array", async () => {
      await batchDeleteDisplayTransactions([]);
      expect(mockDb.write).not.toHaveBeenCalled();
    });

    it("should batch-delete transactions", async () => {
      seedAccount("acc-1", 800);
      const i1 = mockModel("tx-1", {
        _type: "transaction",
        accountId: "acc-1",
        amount: 100,
        isExpense: true,
        isIncome: false,
        deleted: false,
      });
      const i2 = mockModel("tx-2", {
        _type: "transaction",
        accountId: "acc-1",
        amount: 200,
        isExpense: true,
        isIncome: false,
        deleted: false,
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- MockModelRecord cannot satisfy WatermelonDB Model base class
      await batchDeleteDisplayTransactions([
        i1,
        i2,
      ] as unknown as readonly DisplayTransaction[]);
      expect(i1.deleted).toBe(true);
      expect(i2.deleted).toBe(true);
      expect(mockDb.batch).toHaveBeenCalledTimes(1);
    });

    it("should handle mixed transactions and transfers", async () => {
      seedAccount("acc-1", 900);
      seedAccount("acc-2", 500);
      const txI = mockModel("tx-1", {
        _type: "transaction",
        accountId: "acc-1",
        amount: 100,
        isExpense: true,
        isIncome: false,
        deleted: false,
      });
      const tfI = mockModel("tf-1", {
        _type: "transfer",
        fromAccountId: "acc-1",
        toAccountId: "acc-2",
        amount: 200,
        convertedAmount: undefined,
        deleted: false,
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- MockModelRecord cannot satisfy WatermelonDB Model base class
      await batchDeleteDisplayTransactions([
        txI,
        tfI,
      ] as unknown as readonly DisplayTransaction[]);
      expect(txI.deleted).toBe(true);
      expect(tfI.deleted).toBe(true);
      expect(mockDb.batch).toHaveBeenCalledTimes(1);
    });
  });
});
