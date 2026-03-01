/**
 * BaseTransfer - Abstract Base Model for WatermelonDB
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 * Run 'npm run db:sync' to regenerate
 *
 * Extend this class in ../Transfer.ts to add custom methods
 */

import { Model, type Relation } from "@nozbe/watermelondb";
import {
  date,
  field,
  readonly,
  relation,
} from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";
import type { CurrencyType } from "../../types";
import type { BaseAccount } from "./base-account";

export abstract class BaseTransfer extends Model {
  static table = "transfers";
  static associations: Associations = {
    from_account_accounts: { type: "belongs_to", key: "from_account_id" },
    to_account_accounts: { type: "belongs_to", key: "to_account_id" },
  };

  @field("amount") amount!: number;
  @field("converted_amount") convertedAmount?: number;
  @readonly @date("created_at") createdAt!: Date;
  @field("currency") currency!: CurrencyType;
  @date("date") date!: Date;
  @field("deleted") deleted!: boolean;
  @field("exchange_rate") exchangeRate?: number;
  @field("from_account_id") fromAccountId!: string;
  @field("notes") notes?: string;
  @field("sms_body_hash") smsBodyHash?: string;
  @field("to_account_id") toAccountId!: string;
  @date("updated_at") updatedAt!: Date;
  @field("user_id") userId!: string;

  @relation("accounts", "from_account_id") fromAccount!: Relation<BaseAccount>;
  @relation("accounts", "to_account_id") toAccount!: Relation<BaseAccount>;
}
