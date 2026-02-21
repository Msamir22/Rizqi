/**
 * BaseDailySnapshotAssets - Abstract Base Model for WatermelonDB
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 * Run 'npm run db:sync' to regenerate
 *
 * Extend this class in ../DailySnapshotAssets.ts to add custom methods
 */

import { Model } from "@nozbe/watermelondb";
import { date, field, readonly } from "@nozbe/watermelondb/decorators";

export abstract class BaseDailySnapshotAssets extends Model {
  static table = "daily_snapshot_assets";

  @readonly @date("created_at") createdAt!: Date;
  @date("snapshot_date") snapshotDate!: Date;
  @field("total_assets_usd") totalAssetsUsd!: number;
  @field("user_id") userId!: string;
}
