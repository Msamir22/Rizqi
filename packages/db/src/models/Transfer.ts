import { BaseTransfer } from "./base/base-transfer";

export class Transfer extends BaseTransfer {
  get isCrossCurrency(): boolean {
    return this.exchangeRate !== undefined && this.exchangeRate !== null;
  }

  get destinationAmount(): number {
    return this.convertedAmount ?? this.amount;
  }

  get dateInMs(): number {
    return this.date.getTime();
  }
}
