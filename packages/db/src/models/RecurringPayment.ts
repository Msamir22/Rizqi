import { BaseRecurringPayment } from "./base/base-recurring-payment";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function assertValidDate(date: Date, label: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid recurring payment ${label}`);
  }
}

export function calculateDaysUntilDue(dueDate: Date): number {
  assertValidDate(dueDate, "due date");
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const dueUtc = Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate()
  );
  const diffTime = dueUtc - todayUtc;
  return Math.ceil(diffTime / MS_PER_DAY);
}

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

  get isInThisMonth(): boolean {
    const today = new Date();
    return (
      this.nextDueDate.getUTCMonth() === today.getUTCMonth() &&
      this.nextDueDate.getUTCFullYear() === today.getUTCFullYear()
    );
  }
}
