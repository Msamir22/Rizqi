/**
 * SMS Sync Shared Types
 *
 * Shared interfaces for the SMS sync wizard components.
 * Consumed by AccountSetupStep, SenderAccountMapper, and AccountCard.
 */

import type { AccountType, CurrencyType } from "@astik/db";

/** Form data for a single account card */
export interface AccountCardData {
  /** Internal key (crypto-random or sender config id) */
  readonly key: string;
  /** Source sender config ID (if from auto-detection) */
  readonly senderConfigId?: string;
  /** Account name (editable) */
  name: string;
  /** Account type */
  accountType: AccountType;
  /** Currency */
  currency: CurrencyType;
  /** Whether this is the default account */
  isDefault: boolean;
}

/** A payment channel that must be mapped to an existing account */
export interface ChannelMapping {
  readonly senderConfigId: string;
  readonly displayName: string;
  /** Account key this channel is mapped to */
  assignedAccountKey: string | undefined;
}
