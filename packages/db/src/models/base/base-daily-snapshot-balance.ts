/**
 * BaseDailySnapshotBalance - Abstract Base Model for WatermelonDB
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 * Run 'npm run db:sync' to regenerate
 *
 * Extend this class in ../DailySnapshotBalance.ts to add custom methods
 */

import { Model } from "@nozbe/watermelondb";
import { date, field, readonly } from "@nozbe/watermelondb/decorators";

export abstract class BaseDailySnapshotBalance extends Model {
  static table = "daily_snapshot_balance";

  @readonly @date("created_at") createdAt!: Date;
  @date("snapshot_date") snapshotDate!: Date;
  @field("total_accounts_usd") totalAccountsUsd!: number;
  @field("user_id") userId!: string;
}
