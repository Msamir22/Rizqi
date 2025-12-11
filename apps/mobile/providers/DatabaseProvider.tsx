/**
 * Database Provider for Astik Mobile
 * Provides WatermelonDB context to the app
 */

import React, { createContext, useContext, ReactNode } from "react";
import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { schema, Account, Transaction } from "@astik/db";

// Create the adapter
const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  onSetUpError: (error) => console.error("Database setup error:", error),
});

// Create the database instance
export const database = new Database({
  adapter,
  modelClasses: [Account, Transaction],
});

// Create Context
const DatabaseContext = createContext<Database | null>(null);

// Provider Component
interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
}

// Hook to access database
export function useDatabase(): Database {
  const db = useContext(DatabaseContext);
  if (!db) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return db;
}

// Hook to get accounts collection
export function useAccounts() {
  const db = useDatabase();
  return db.get<Account>("accounts");
}

// Hook to get transactions collection
export function useTransactions() {
  const db = useDatabase();
  return db.get<Transaction>("transactions");
}
