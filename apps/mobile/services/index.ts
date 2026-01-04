/**
 * Services index
 * Central export for all service modules
 */

export {
  supabase,
  getCurrentUserId,
  isAuthenticated,
  signInAnonymously,
} from "./supabase";
export { syncDatabase } from "./sync";
export {
  fetchMarketRates,
  refreshMarketRates,
  convertToEgp,
  convertFromEgp,
  calculateGoldValue,
  calculateSilverValue,
} from "./rates";
export type { MarketRates } from "./rates";
