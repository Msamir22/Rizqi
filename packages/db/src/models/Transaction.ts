/**
 * Transaction Model for WatermelonDB
 */

import { Model, Relation } from "@nozbe/watermelondb";
import {
  field,
  readonly,
  date,
  relation,
} from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";
import { Account } from "./Account";

export class Transaction extends Model {
  static table = "transactions";
  static associations: Associations = {
    accounts: { type: "belongs_to", key: "account_id" },
  };

  @field("amount") amount!: number;
  @field("currency") currency!: "EGP" | "USD" | "XAU";
  @field("category") category!: string;
  @field("merchant") merchant?: string;
  @field("account_id") accountId!: string;
  @field("note") note!: string;
  @field("is_draft") isDraft!: boolean;
  @field("is_expense") isExpense!: boolean;
  @field("notification_source") notificationSource?:
    | "bank_sms"
    | "voice"
    | "manual";

  @readonly @date("created_at") createdAt!: Date;

  @relation("accounts", "account_id") account!: Relation<Account>;
}
