/**
 * Account Model for WatermelonDB
 */

import { Model, Query } from '@nozbe/watermelondb';
import { field, readonly, date, children } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';

export class Account extends Model {
  static table = 'accounts';
  static associations: Associations = {
    transactions: { type: 'has_many', foreignKey: 'account_id' },
  };

  @field('name') name!: string;
  @field('type') type!: 'CASH' | 'BANK' | 'GOLD' | 'ASSET';
  @field('currency') currency!: 'EGP' | 'USD' | 'XAU';
  @field('balance') balance!: number;
  @field('is_liquid') isLiquid!: boolean;

  // Optional bank integration
  @field('bank_name') bankName?: string;
  @field('card_last_4') cardLast4?: string;
  @field('account_number') accountNumber?: string;

  // Gold-specific
  @field('gold_karat') goldKarat?: number;
  @field('gold_weight_grams') goldWeightGrams?: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('transactions') transactions!: Query<Model>;
}
