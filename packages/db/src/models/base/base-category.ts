/**
 * BaseCategory - Abstract Base Model for WatermelonDB
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 * Run 'npm run db:sync' to regenerate
 *
 * Extend this class in ../Category.ts to add custom methods
 */

import { Model, type Relation, Query } from "@nozbe/watermelondb";
import {
  children,
  date,
  field,
  readonly,
  relation,
} from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";
import type { CategoryNature, TransactionType } from "../../types";

export abstract class BaseCategory extends Model {
  static table = "categories";
  static associations: Associations = {
    categories: { type: "belongs_to", key: "parent_id" },
    budgets: { type: "has_many", foreignKey: "category_id" },
    recurring_payments: { type: "has_many", foreignKey: "category_id" },
    transactions: { type: "has_many", foreignKey: "category_id" },
    user_category_settings: { type: "has_many", foreignKey: "category_id" },
  };

  @field("color") color?: string;
  @readonly @date("created_at") createdAt!: Date;
  @field("deleted") deleted!: boolean;
  @field("display_name") displayName!: string;
  @field("icon") icon!: string;
  @field("icon_library") iconLibrary!: string;
  @field("is_hidden") isHidden!: boolean;
  @field("is_internal") isInternal!: boolean;
  @field("is_system") isSystem!: boolean;
  @field("level") level!: number;
  @field("nature") nature?: CategoryNature;
  @field("parent_id") parentId?: string;
  @field("sort_order") sortOrder?: number;
  @field("system_name") systemName!: string;
  @field("type") type?: TransactionType;
  @date("updated_at") updatedAt!: Date;
  @field("usage_count") usageCount!: number;
  @field("user_id") userId?: string;

  @relation("categories", "parent_id") parent!: Relation<BaseCategory>;
  @children("budgets") budgets!: Query<Model>;
  @children("recurring_payments") recurringPayments!: Query<Model>;
  @children("transactions") transactions!: Query<Model>;
  @children("user_category_settings") userCategorySettings!: Query<Model>;
}
