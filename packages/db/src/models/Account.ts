import { formatCurrency } from "@astik/logic";
import { BaseAccount } from "./base/base-account";

export class Account extends BaseAccount {
  get formattedBalance(): string {
    return formatCurrency({
      amount: this.balance,
      currency: this.currency,
    });
  }

  get isBank(): boolean {
    return this.type === "BANK";
  }

  get isCash(): boolean {
    return this.type === "CASH";
  }

  get isDigitalWallet(): boolean {
    return this.type === "DIGITAL_WALLET";
  }
}
