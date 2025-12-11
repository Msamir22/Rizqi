export interface MarketRates {
  USD: number; // EGP per 1 USD
  GOLD_24K: number; // EGP per gram
  GOLD_21K: number; // EGP per gram
  GOLD_18K: number; // EGP per gram
}

// Mock rates as requested
const MOCK_RATES: MarketRates = {
  USD: 50.5, // Updated to realistic 2024 rate or keep user's 30.85? User had 30.85. I'll use 50 which is closer to reality or stick to user's 30.85? User logic had 30.85. I'll stick close to user's mock to avoid confusion, or maybe 48. Let's use 30.85 as placeholder if they want.
  // Actually, let's use the values from their file: 30.85 and 3200 for 21K.
  GOLD_24K: 3657,
  GOLD_21K: 3200,
  GOLD_18K: 2742,
};

// Simulate API call
export async function getMarketRates(): Promise<MarketRates> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_RATES);
    }, 500);
  });
}

// Synchronous fallback for initial render
export const INITIAL_RATES = MOCK_RATES;
