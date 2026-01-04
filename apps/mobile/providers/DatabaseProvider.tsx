/**
 * Database Provider for Astik Mobile
 * Provides WatermelonDB context to the app and handles initialization
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import {
  schema,
  Account,
  Transaction,
  Profile,
  BankDetails,
  Asset,
  AssetMetal,
  Category,
  UserCategorySettings,
  Debt,
  RecurringPayment,
  Transfer,
  Budget,
} from "@astik/db";
import { seedCategories } from "../utils/seed-categories";

// All model classes for the database
const modelClasses = [
  Profile,
  Account,
  BankDetails,
  Asset,
  AssetMetal,
  Category,
  UserCategorySettings,
  Debt,
  RecurringPayment,
  Transaction,
  Transfer,
  Budget,
];

// Create the adapter with error handling
let adapter: SQLiteAdapter;
try {
  adapter = new SQLiteAdapter({
    schema,
    jsi: false,
    onSetUpError: (error) => console.error("Database setup error:", error),
  });
} catch (error) {
  console.error("Failed to create SQLite adapter:", error);
  adapter = new SQLiteAdapter({
    schema,
    jsi: false,
    onSetUpError: (error) => console.error("Database setup error:", error),
  });
}

// Create the database instance
export const database = new Database({
  adapter,
  modelClasses,
});

// Create Context
interface DatabaseContextValue {
  database: Database;
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// Provider Component
interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({
  children,
}: DatabaseProviderProps): JSX.Element {
  const [isReady, setIsReady] = useState(false);

  // Initialize database and seed data on first launch
  useEffect(() => {
    const initializeDatabase = async (): Promise<void> => {
      try {
        // Seed system categories if needed
        await seedCategories();
        setIsReady(true);
      } catch (error) {
        console.error("Database initialization error:", error);
        // Still set ready to avoid app hanging
        setIsReady(true);
      }
    };

    initializeDatabase();
  }, []);

  return (
    <DatabaseContext.Provider value={{ database, isReady }}>
      {children}
    </DatabaseContext.Provider>
  );
}

// Hook to access database
export function useDatabase(): Database {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context.database;
}

// Hook to check if database is ready
export function useDatabaseReady(): boolean {
  const context = useContext(DatabaseContext);
  return context?.isReady ?? false;
}

// Hook to get accounts collection
export function useAccountsCollection() {
  const db = useDatabase();
  return db.get<Account>("accounts");
}

// Hook to get transactions collection
export function useTransactionsCollection() {
  const db = useDatabase();
  return db.get<Transaction>("transactions");
}

// Hook to get categories collection
export function useCategoriesCollection() {
  const db = useDatabase();
  return db.get<Category>("categories");
}
