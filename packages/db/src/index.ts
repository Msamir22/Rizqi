// Schema
export { schema } from "./schema";

// Types (exported from central location)
export * from "./types";

// Models (extended classes with custom logic)
export { Account } from "./models/Account";
export { AssetMetal } from "./models/AssetMetal";
export { Asset } from "./models/Asset";
export { BankDetails } from "./models/BankDetails";
export { Budget } from "./models/Budget";
export { Category } from "./models/Category";
export { Debt } from "./models/Debt";
export { MarketRate } from "./models/MarketRate";
export { Profile } from "./models/Profile";
export { RecurringPayment } from "./models/RecurringPayment";
export { Transaction } from "./models/Transaction";
export { Transfer } from "./models/Transfer";
export { UserCategorySettings } from "./models/UserCategorySettings";

// Database
export { database } from "./database";
export type { Database as SupabaseDatabase } from "./supabase-types";
