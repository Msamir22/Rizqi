/**
 * Database Provider for Astik Mobile
 * Provides WatermelonDB context to the app and handles initialization
 */

import { Account, Category, database, Transaction } from "@astik/db";
import { Collection, Database } from "@nozbe/watermelondb";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

  // Initialize database
  useEffect(() => {
    const initializeDatabase = (): void => {
      try {
        setIsReady(true);
      } catch (error) {
        console.error("Database initialization error:", error);
        setIsReady(true);
      }
    };

    initializeDatabase();
  }, []);

  const value = useMemo<DatabaseContextValue>(
    () => ({ database, isReady }),
    [isReady]
  );

  return (
    <DatabaseContext.Provider value={value}>
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
export function useAccountsCollection(): Collection<Account> {
  const db = useDatabase();
  return db.get<Account>("accounts");
}

// Hook to get transactions collection
export function useTransactionsCollection(): Collection<Transaction> {
  const db = useDatabase();
  return db.get<Transaction>("transactions");
}

// Hook to get categories collection
export function useCategoriesCollection(): Collection<Category> {
  const db = useDatabase();
  return db.get<Category>("categories");
}
