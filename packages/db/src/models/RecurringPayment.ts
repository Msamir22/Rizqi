import {
  calculateDaysUntilDue,
  getDueText,
} from "../../../../apps/mobile/utils/dateHelpers";
import { BaseRecurringPayment } from "./base/base-recurring-payment";

export class RecurringPayment extends BaseRecurringPayment {
  get isActive(): boolean {
    return this.status === "ACTIVE";
  }

  get isPaused(): boolean {
    return this.status === "PAUSED";
  }

  get isCompleted(): boolean {
    return this.status === "COMPLETED";
  }

  get isExpense(): boolean {
    return this.type === "EXPENSE";
  }

  get isIncome(): boolean {
    return this.type === "INCOME";
  }

  get shouldAutoCreate(): boolean {
    return this.action === "AUTO_CREATE";
  }

  get isDue(): boolean {
    return this.nextDueDate <= new Date();
  }

  get daysUntilDue(): number {
    return calculateDaysUntilDue(this.nextDueDate);
  }

  get isOverdue(): boolean {
    return this.daysUntilDue < 0;
  }

  get dueText(): string {
    return getDueText(this.nextDueDate);
  }

  get isInThisMonth(): boolean {
    const today = new Date();
    return (
      this.nextDueDate.getMonth() === today.getMonth() &&
      this.nextDueDate.getFullYear() === today.getFullYear()
    );
  }
}
