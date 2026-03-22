/**
 * BaseBudget - Abstract Base Model for WatermelonDB
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 * Run 'npm run db:sync' to regenerate
 *
 * Extend this class in ../Budget.ts to add custom methods
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
  AlertFiredLevel,
  CurrencyType,
  BudgetPeriod,
  BudgetStatus,
  BudgetType,
} from "../../types";
import type { BaseCategory } from "./base-category";

export abstract class BaseBudget extends Model {
  static table = "budgets";
  static associations: Associations = {
    categories: { type: "belongs_to", key: "category_id" },
  };

  @field("alert_fired_level") alertFiredLevel?: AlertFiredLevel;
  @field("alert_threshold") alertThreshold!: number;
  @field("amount") amount!: number;
  @field("category_id") categoryId?: string;
  @readonly @date("created_at") createdAt!: Date;
  @field("currency") currency?: CurrencyType;
  @field("deleted") deleted!: boolean;
  @field("name") name!: string;
  @field("pause_intervals") pauseIntervals!: string;
  @field("paused_at") pausedAt?: string;
  @field("period") period!: BudgetPeriod;
  @date("period_end") periodEnd?: Date;
  @date("period_start") periodStart?: Date;
  @field("status") status!: BudgetStatus;
  @field("type") type!: BudgetType;
  @date("updated_at") updatedAt!: Date;
  @field("user_id") userId!: string;

  @relation("categories", "category_id") category!: Relation<BaseCategory>;
}
