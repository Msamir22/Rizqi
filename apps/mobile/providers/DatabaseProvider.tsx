/**
 * Database Provider for Astik Mobile
 * Provides WatermelonDB context to the app and handles initialization
 */

import { Account, Category, database, Transaction } from "@astik/db";
import { Database } from "@nozbe/watermelondb";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { seedCategories } from "../utils/seed-categories";

interface DatabaseContextValue {
  database: Database;
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

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
