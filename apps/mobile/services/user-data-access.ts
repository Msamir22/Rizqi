/**
 * Runtime user-scoped data access helpers.
 *
 * Defense-in-depth on top of Supabase RLS and local SQLite reset-on-logout:
 * direct local reads must still prove that the row belongs to the current
 * authenticated user before exposing or mutating it.
 *
 * @module user-data-access
 */

import { Q, type Collection, type Model } from "@nozbe/watermelondb";
import type { Clause } from "@nozbe/watermelondb/QueryDescription";
import type Query from "@nozbe/watermelondb/Query";
import { getCurrentUserId } from "./supabase";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const USER_DATA_ACCESS_ERROR_CODES = {
  USER_REQUIRED: "USER_REQUIRED",
  OWNERSHIP_FAILED: "OWNERSHIP_FAILED",
  INVALID_PARENT_REFERENCE: "INVALID_PARENT_REFERENCE",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserOwnedRecord {
  readonly id: string;
  readonly userId: string;
}

export interface UserScopedCategoryRecord {
  readonly id: string;
  readonly userId?: string | null;
}

interface FindableCollection<TRecord> {
  readonly find: (id: string) => Promise<TRecord>;
}

interface SubscriptionLike {
  readonly unsubscribe: () => void;
}

interface ObserverLike<TValue> {
  readonly next: (value: TValue) => void;
  readonly error?: (error: unknown) => void;
  readonly complete?: () => void;
}

interface ObservableLike<TValue> {
  readonly subscribe: (observer: ObserverLike<TValue>) => SubscriptionLike;
}

interface ObservableCollection<TRecord> {
  readonly findAndObserve: (id: string) => ObservableLike<TRecord>;
}

// ---------------------------------------------------------------------------
// Auth Guard
// ---------------------------------------------------------------------------

/**
 * Returns the current authenticated user id or throws a stable guard error.
 */
export async function getRequiredCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  const normalizedUserId = userId?.trim();

  if (!normalizedUserId) {
    throw new Error(USER_DATA_ACCESS_ERROR_CODES.USER_REQUIRED);
  }

  return normalizedUserId;
}

// ---------------------------------------------------------------------------
// Ownership Guards
// ---------------------------------------------------------------------------

/**
 * Assert that a direct user-owned record belongs to the current user.
 */
export function assertOwnedRecord<TRecord extends UserOwnedRecord>(
  record: TRecord,
  currentUserId: string
): TRecord {
  if (record.userId !== currentUserId) {
    throw new Error(USER_DATA_ACCESS_ERROR_CODES.OWNERSHIP_FAILED);
  }

  return record;
}

/**
 * Assert that a category is visible to the current user.
 *
 * System categories have no `userId` and are shared by all users.
 * Custom categories have a concrete `userId` and are user-scoped.
 */
export function assertAccessibleCategory<
  TRecord extends UserScopedCategoryRecord,
>(record: TRecord, currentUserId: string): TRecord {
  if (
    record.userId === null ||
    record.userId === undefined ||
    record.userId === currentUserId
  ) {
    return record;
  }

  throw new Error(USER_DATA_ACCESS_ERROR_CODES.OWNERSHIP_FAILED);
}

/**
 * Find a record by id, then assert ownership before returning it.
 */
export async function findOwnedById<TRecord extends UserOwnedRecord>(
  collection: FindableCollection<TRecord>,
  id: string,
  currentUserId: string
): Promise<TRecord> {
  const record = await collection.find(id);
  return assertOwnedRecord(record, currentUserId);
}

/**
 * Observe a single record by id, but emit `null` when the row is foreign.
 */
export function observeOwnedById<TRecord extends UserOwnedRecord>(
  collection: ObservableCollection<TRecord>,
  id: string,
  currentUserId: string
): ObservableLike<TRecord | null> {
  return {
    subscribe: (observer: ObserverLike<TRecord | null>): SubscriptionLike => {
      return collection.findAndObserve(id).subscribe({
        next: (record: TRecord): void => {
          observer.next(record.userId === currentUserId ? record : null);
        },
        error: (error: unknown): void => {
          observer.error?.(error);
        },
        complete: (): void => {
          observer.complete?.();
        },
      });
    },
  };
}

/**
 * Build a direct user-scoped query for tables that carry `user_id`.
 */
export function queryOwned<TRecord extends Model & UserOwnedRecord>(
  collection: Collection<TRecord>,
  currentUserId: string,
  ...conditions: Clause[]
): Query<TRecord> {
  return collection.query(Q.where("user_id", currentUserId), ...conditions);
}

/**
 * Assert that a child row without `user_id` belongs to the current user through
 * an owned parent row.
 */
export async function assertChildRecordParentOwned<
  TChildRecord extends { readonly id: string },
  TParentRecord extends UserOwnedRecord,
  TForeignKey extends keyof TChildRecord,
>(
  childRecord: TChildRecord,
  parentCollection: FindableCollection<TParentRecord>,
  parentForeignKey: TForeignKey,
  currentUserId: string
): Promise<TChildRecord> {
  const parentId = childRecord[parentForeignKey];

  if (typeof parentId !== "string" || parentId.trim().length === 0) {
    throw new Error(USER_DATA_ACCESS_ERROR_CODES.INVALID_PARENT_REFERENCE);
  }

  await findOwnedById(parentCollection, parentId, currentUserId);
  return childRecord;
}
