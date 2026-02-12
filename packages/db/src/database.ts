/**
 * WatermelonDB Database Configuration
 * Complete database setup with all models
 */

import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { setGenerator } from "@nozbe/watermelondb/utils/common/randomId";

// Import all models
import { Account } from "./models/Account";
import { Asset } from "./models/Asset";
import { AssetMetal } from "./models/AssetMetal";
import { BankDetails } from "./models/BankDetails";
import { Budget } from "./models/Budget";
import { Category } from "./models/Category";
import { Debt } from "./models/Debt";
import { MarketRate } from "./models/MarketRate";
import { Profile } from "./models/Profile";
import { RecurringPayment } from "./models/RecurringPayment";
import { Transaction } from "./models/Transaction";
import { Transfer } from "./models/Transfer";
import { UserCategorySettings } from "./models/UserCategorySettings";
import { migrations } from "./migrations";
import { schema } from "./schema";

// =============================================================================
// UUID Generator for Supabase Compatibility
// =============================================================================

/**
 * Generate UUID v4 strings for database IDs
 * Supabase requires UUID format, so we override WatermelonDB's default
 */
function generateUUID(): string {
  let d = new Date().getTime();
  let d2 =
    (typeof performance !== "undefined" &&
      performance.now &&
      performance.now() * 1000) ||
    0;

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = Math.random() * 16;

    if (d > 0) {
      // eslint-disable-next-line no-bitwise
      r = ((d + r) % 16) | 0;
      d = Math.floor(d / 16);
    } else {
      // eslint-disable-next-line no-bitwise
      r = ((d2 + r) % 16) | 0;
      d2 = Math.floor(d2 / 16);
    }

    // eslint-disable-next-line no-bitwise
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Set the global ID generator BEFORE creating the database
setGenerator(generateUUID);

let adapter: SQLiteAdapter;
try {
  adapter = new SQLiteAdapter({
    schema,
    migrations,
    jsi: true,
    onSetUpError: (error) => console.error("Database setup error:", error),
  });
} catch (error) {
  console.error("Failed to create SQLite adapter:", error);
  adapter = new SQLiteAdapter({
    schema,
    migrations,
    jsi: false,
    onSetUpError: (error) => console.error("Database setup error:", error),
  });
}

export const database = new Database({
  adapter,
  modelClasses: [
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
    MarketRate,
  ],
});
