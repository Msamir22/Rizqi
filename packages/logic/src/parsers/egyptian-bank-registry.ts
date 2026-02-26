/**
 * Egyptian Financial Institution Sender Registry
 *
 * Lightweight registry of known Egyptian bank, wallet, and fintech
 * SMS sender IDs. Used by the SMS pipeline to filter messages from
 * recognized financial institutions before sending them to AI parsing.
 *
 * Architecture & Design Rationale:
 * - Pattern: Registry / Lookup Map
 * - Why: O(1) sender lookup instead of O(n) regex scanning.
 *   Single responsibility — only identifies senders, no parsing logic.
 * - SOLID: SRP — sender identification is separate from SMS parsing (SRP).
 *   Open/Closed — new banks are added by extending the array, not
 *   modifying existing code.
 *
 * @module parsers/egyptian-bank-registry
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Type of financial institution. */
type InstitutionType = "bank" | "wallet" | "payment" | "bnpl";

/** Metadata about a recognized financial sender. */
export interface BankInfo {
  /** Full official name (e.g., "Commercial International Bank"). */
  readonly fullName: string;
  /** Short display name (e.g., "CIB"). */
  readonly shortName: string;
  /** Institution type for routing logic. */
  readonly type: InstitutionType;
}

// ---------------------------------------------------------------------------
// Registry Data
// ---------------------------------------------------------------------------

/**
 * Raw registry entries: each entry maps one or more SMS sender ID
 * substrings → BankInfo metadata.
 *
 * Sender IDs are stored lowercase. Matching is case-insensitive
 * substring match against the SMS address field.
 */
interface RegistryEntry {
  readonly senderPatterns: readonly string[];
  readonly info: BankInfo;
}

const REGISTRY_ENTRIES: readonly RegistryEntry[] = [
  // ── Egyptian Public Banks ──────────────────────────────────────────────
  {
    senderPatterns: ["nbe", "nbegypt", "nbebank", "nbemobile"],
    info: {
      fullName: "National Bank of Egypt",
      shortName: "NBE",
      type: "bank",
    },
  },
  {
    senderPatterns: ["banquemisr", "bmisr", "bm"],
    info: { fullName: "Banque Misr", shortName: "Banque Misr", type: "bank" },
  },
  {
    senderPatterns: ["banquecaire", "bdc"],
    info: {
      fullName: "Banque du Caire",
      shortName: "Banque du Caire",
      type: "bank",
    },
  },
  {
    senderPatterns: ["alexbank", "alexalerts"],
    info: {
      fullName: "Bank of Alexandria",
      shortName: "AlexBank",
      type: "bank",
    },
  },
  {
    senderPatterns: ["agribank", "abe"],
    info: {
      fullName: "Agricultural Bank of Egypt",
      shortName: "Agri Bank",
      type: "bank",
    },
  },
  {
    senderPatterns: ["ealb"],
    info: {
      fullName: "Egyptian Arab Land Bank",
      shortName: "EALB",
      type: "bank",
    },
  },
  {
    senderPatterns: ["idbegypt", "idb"],
    info: {
      fullName: "Industrial Development Bank",
      shortName: "IDB",
      type: "bank",
    },
  },
  {
    senderPatterns: ["unitedbank", "ub"],
    info: {
      fullName: "The United Bank",
      shortName: "United Bank",
      type: "bank",
    },
  },
  {
    senderPatterns: ["scbank", "scb"],
    info: { fullName: "Suez Canal Bank", shortName: "SC Bank", type: "bank" },
  },
  {
    senderPatterns: ["hdbank", "hdb"],
    info: {
      fullName: "Housing & Development Bank",
      shortName: "HD Bank",
      type: "bank",
    },
  },
  {
    senderPatterns: ["edbbank", "edb"],
    info: {
      fullName: "Export Development Bank",
      shortName: "EDB",
      type: "bank",
    },
  },

  // ── Egyptian Private Banks ─────────────────────────────────────────────
  {
    senderPatterns: ["cib", "cibank", "cibegypt"],
    info: {
      fullName: "Commercial International Bank",
      shortName: "CIB",
      type: "bank",
    },
  },
  {
    senderPatterns: ["qnb", "qnbalahli"],
    info: { fullName: "QNB Al Ahli", shortName: "QNB", type: "bank" },
  },
  {
    senderPatterns: ["aaib"],
    info: {
      fullName: "Arab African International Bank",
      shortName: "AAIB",
      type: "bank",
    },
  },
  {
    senderPatterns: ["faisal", "faisalbank"],
    info: {
      fullName: "Faisal Islamic Bank of Egypt",
      shortName: "Faisal Bank",
      type: "bank",
    },
  },
  {
    senderPatterns: ["albaraka"],
    info: {
      fullName: "Al Baraka Bank Egypt",
      shortName: "Al Baraka",
      type: "bank",
    },
  },
  {
    senderPatterns: ["egbank", "egb"],
    info: {
      fullName: "Egyptian Gulf Bank",
      shortName: "EG Bank",
      type: "bank",
    },
  },
  {
    senderPatterns: ["aib", "arabintl"],
    info: {
      fullName: "Arab International Bank",
      shortName: "AIB",
      type: "bank",
    },
  },
  {
    senderPatterns: ["ainves", "ainvest"],
    info: {
      fullName: "Arab Investment Bank",
      shortName: "Arab Invest",
      type: "bank",
    },
  },
  {
    senderPatterns: ["midbank"],
    info: { fullName: "MIDBank", shortName: "MIDBank", type: "bank" },
  },
  {
    senderPatterns: ["saib"],
    info: {
      fullName: "Societe Arabe Internationale de Banque",
      shortName: "SAIB",
      type: "bank",
    },
  },

  // ── International Banks in Egypt ───────────────────────────────────────
  {
    senderPatterns: ["hsbc", "hsbcegypt"],
    info: { fullName: "HSBC Egypt", shortName: "HSBC", type: "bank" },
  },
  {
    senderPatterns: ["caegypt", "ca-egypt", "creditagri"],
    info: {
      fullName: "Credit Agricole Egypt",
      shortName: "Credit Agricole",
      type: "bank",
    },
  },
  {
    senderPatterns: ["adib"],
    info: {
      fullName: "Abu Dhabi Islamic Bank Egypt",
      shortName: "ADIB",
      type: "bank",
    },
  },
  {
    senderPatterns: ["adcb"],
    info: {
      fullName: "Abu Dhabi Commercial Bank Egypt",
      shortName: "ADCB",
      type: "bank",
    },
  },
  {
    senderPatterns: ["emiratesnbd", "enbd"],
    info: {
      fullName: "Emirates NBD Egypt",
      shortName: "Emirates NBD",
      type: "bank",
    },
  },
  {
    senderPatterns: ["fabmisr", "fab"],
    info: {
      fullName: "First Abu Dhabi Bank Misr",
      shortName: "FAB Misr",
      type: "bank",
    },
  },
  {
    senderPatterns: ["mashreq", "mashreqbank", "mashreq-egy"],
    info: {
      fullName: "Mashreq Bank Egypt",
      shortName: "Mashreq",
      type: "bank",
    },
  },
  {
    senderPatterns: ["citi", "citibank"],
    info: { fullName: "Citibank Egypt", shortName: "Citibank", type: "bank" },
  },
  {
    senderPatterns: ["awb", "attijari", "attijariwafa"],
    info: {
      fullName: "Attijariwafa Bank Egypt",
      shortName: "Attijariwafa",
      type: "bank",
    },
  },
  {
    senderPatterns: ["abk", "abkegypt"],
    info: {
      fullName: "Al Ahli Bank of Kuwait - Egypt",
      shortName: "ABK Egypt",
      type: "bank",
    },
  },
  {
    senderPatterns: ["nbk", "nbkegypt"],
    info: {
      fullName: "National Bank of Kuwait - Egypt",
      shortName: "NBK Egypt",
      type: "bank",
    },
  },
  {
    senderPatterns: ["aub"],
    info: {
      fullName: "Ahli United Bank Egypt",
      shortName: "AUB",
      type: "bank",
    },
  },
  {
    senderPatterns: ["arabbank"],
    info: { fullName: "Arab Bank PLC", shortName: "Arab Bank", type: "bank" },
  },
  {
    senderPatterns: ["bankabc", "abc"],
    info: { fullName: "Bank ABC Egypt", shortName: "Bank ABC", type: "bank" },
  },
  {
    senderPatterns: ["blom"],
    info: { fullName: "BLOM Bank Egypt", shortName: "BLOM", type: "bank" },
  },

  // ── Digital Wallets & Fintechs ─────────────────────────────────────────
  {
    senderPatterns: ["vf-cash", "vfcash"],
    info: {
      fullName: "Vodafone Cash",
      shortName: "Vodafone Cash",
      type: "wallet",
    },
  },
  {
    senderPatterns: ["orangecash"],
    info: { fullName: "Orange Cash", shortName: "Orange Cash", type: "wallet" },
  },
  {
    senderPatterns: ["wepay"],
    info: {
      fullName: "WE Pay",
      shortName: "WE Pay",
      type: "wallet",
    },
  },
];

// ---------------------------------------------------------------------------
// Lookup Map (built once at import time)
// ---------------------------------------------------------------------------

/**
 * Pre-built map from lowercase sender substring → BankInfo.
 * Used for O(1) exact-match lookups after normalizing the sender address.
 */
const SENDER_LOOKUP_MAP: ReadonlyMap<string, BankInfo> = buildLookupMap();

function buildLookupMap(): Map<string, BankInfo> {
  const map = new Map<string, BankInfo>();
  for (const entry of REGISTRY_ENTRIES) {
    for (const pattern of entry.senderPatterns) {
      map.set(pattern.toLowerCase(), entry.info);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if an SMS sender address belongs to a known Egyptian
 * financial institution.
 *
 * Performs case-insensitive matching against the registry.
 * First tries exact match, then falls back to substring search
 * for addresses that contain extra prefixes/suffixes
 * (e.g., "CIB-EGYPT" → matches "cib").
 *
 * @param senderAddress - Raw SMS sender address (e.g., "CIB", "NBE", "VF-Cash")
 * @returns BankInfo if matched, undefined otherwise
 *
 * @example
 * ```ts
 * isKnownFinancialSender("CIB");        // → { fullName: "Commercial International Bank", ... }
 * isKnownFinancialSender("CIB-EGYPT");  // → { fullName: "Commercial International Bank", ... }
 * isKnownFinancialSender("Vodafone");   // → { fullName: "Vodafone Cash", ... }
 * isKnownFinancialSender("Telecom");    // → undefined
 * ```
 */
export function isKnownFinancialSender(
  senderAddress: string
): BankInfo | undefined {
  if (!senderAddress) {
    return undefined;
  }

  const normalized = senderAddress.trim().toLowerCase();

  // Fast path: exact match (most common case)
  const exactMatch = SENDER_LOOKUP_MAP.get(normalized);
  if (exactMatch) {
    return exactMatch;
  }

  // Slow path: check if normalized sender contains any known pattern
  // Handles cases like "CIB-EGYPT", "HSBC_EG", "NBE Bank", etc.
  for (const [pattern, info] of SENDER_LOOKUP_MAP) {
    // Only match patterns ≥ 2 chars to avoid false positives from
    // very short substrings (e.g., "we" matching "answer")
    if (pattern.length >= 2 && normalized.includes(pattern)) {
      return info;
    }
  }

  return undefined;
}

/**
 * Get all registered sender patterns for debugging or display.
 *
 * @returns Readonly map of all sender patterns → BankInfo
 */
export function getAllFinancialSenders(): ReadonlyMap<string, BankInfo> {
  return SENDER_LOOKUP_MAP;
}
