/**
 * WatermelonDB Schema for Astik
 * Defines database structure for offline-first architecture
 */

import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "accounts",
      columns: [
        { name: "name", type: "string" },
        { name: "type", type: "string" }, // CASH | BANK | GOLD | ASSET
        { name: "currency", type: "string" }, // EGP | USD | XAU
        { name: "balance", type: "number" },
        { name: "is_liquid", type: "boolean" },

        // Optional bank integration fields
        { name: "bank_name", type: "string", isOptional: true },
        { name: "card_last_4", type: "string", isOptional: true },
        { name: "account_number", type: "string", isOptional: true },

        // Gold-specific fields
        { name: "gold_karat", type: "number", isOptional: true },
        { name: "gold_weight_grams", type: "number", isOptional: true },

        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "transactions",
      columns: [
        { name: "amount", type: "number" },
        { name: "currency", type: "string" }, // EGP | USD | XAU
        { name: "category", type: "string" },
        { name: "merchant", type: "string", isOptional: true },
        { name: "account_id", type: "string", isIndexed: true },
        { name: "note", type: "string" },
        { name: "is_draft", type: "boolean" },
        { name: "is_expense", type: "boolean" },

        // Source tracking
        { name: "notification_source", type: "string", isOptional: true }, // bank_sms | voice | manual

        { name: "created_at", type: "number" },
      ],
    }),
  ],
});
