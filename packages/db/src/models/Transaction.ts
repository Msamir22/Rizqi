import { formatCurrency } from "@monyvi/logic";
import { BaseTransaction } from "./base/base-transaction";

export class Transaction extends BaseTransaction {
  get isExpense(): boolean {
    return this.type === "EXPENSE";
  }

  get isIncome(): boolean {
    return this.type === "INCOME";
  }

  get isFromVoice(): boolean {
    return this.source === "VOICE";
  }

  get dateInMs(): number {
    return this.date.getTime();
  }

  get isFromSMS(): boolean {
    return this.source === "SMS";
  }

  get isAutoCreated(): boolean {
    return this.source === "RECURRING";
  }

  get hasLinkedDebt(): boolean {
    return this.linkedDebtId !== undefined && this.linkedDebtId !== null;
  }

  get hasLinkedAsset(): boolean {
    return this.linkedAssetId !== undefined && this.linkedAssetId !== null;
  }

  get signedFormatedAmount(): string {
    const sign = this.type === "EXPENSE" ? "-" : "+";
    return (
      sign + formatCurrency({ amount: this.amount, currency: this.currency })
    );
  }
}
