/**
 * BaseTransaction - Abstract Base Model for WatermelonDB
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 * Run 'npm run db:sync' to regenerate
 *
 * Extend this class in ../Transaction.ts to add custom methods
 */

import { Model, type Relation } from "@nozbe/watermelondb";
import {
  date,
  field,
  readonly,
  relation,
} from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";
import type {
  CurrencyType,
  TransactionSource,
  TransactionType,
} from "../../types";
import type { BaseAccount } from "./base-account";
import type { BaseCategory } from "./base-category";
import type { BaseAsset } from "./base-asset";
import type { BaseDebt } from "./base-debt";
import type { BaseRecurringPayment } from "./base-recurring-payment";

export abstract class BaseTransaction extends Model {
  static table = "transactions";
  static associations: Associations = {
    accounts: { type: "belongs_to", key: "account_id" },
    categories: { type: "belongs_to", key: "category_id" },
    assets: { type: "belongs_to", key: "linked_asset_id" },
    debts: { type: "belongs_to", key: "linked_debt_id" },
    recurring_payments: { type: "belongs_to", key: "linked_recurring_id" },
  };

  @field("account_id") accountId!: string;
  @field("amount") amount!: number;
  @field("category_id") categoryId!: string;
  @field("counterparty") counterparty?: string;
  @readonly @date("created_at") createdAt!: Date;
  @field("currency") currency!: CurrencyType;
  @date("date") date!: Date;
  @field("deleted") deleted!: boolean;
  @field("is_draft") isDraft!: boolean;
  @field("linked_asset_id") linkedAssetId?: string;
  @field("linked_debt_id") linkedDebtId?: string;
  @field("linked_recurring_id") linkedRecurringId?: string;
  @field("note") note?: string;
  @field("source") source!: TransactionSource;
  @field("type") type!: TransactionType;
  @date("updated_at") updatedAt!: Date;
  @field("user_id") userId!: string;

  @relation("accounts", "account_id") account!: Relation<BaseAccount>;
  @relation("categories", "category_id") category!: Relation<BaseCategory>;
  @relation("assets", "linked_asset_id") linkedAsset!: Relation<BaseAsset>;
  @relation("debts", "linked_debt_id") linkedDebt!: Relation<BaseDebt>;
  @relation("recurring_payments", "linked_recurring_id")
  linkedRecurring!: Relation<BaseRecurringPayment>;
}
