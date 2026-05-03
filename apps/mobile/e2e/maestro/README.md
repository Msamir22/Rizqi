# Maestro E2E Tests

End-to-end tests for the Monyvi mobile app using
[Maestro](https://maestro.mobile.dev/).

## Quick Start

```powershell
# 1. Start emulator + Metro (separate terminal)
npm run start:android

# 2. Run a test
cd apps\mobile
maestro test e2e\maestro\create-transaction.yaml
```

> **First time?** See the full setup in
> [/.agent/workflows/maestro.md](/.agent/workflows/maestro.md)

## Test Flows

| Flow                       | Description                             | Preconditions            |
| -------------------------- | --------------------------------------- | ------------------------ |
| `setup.yaml`               | Shared: launches app → Transactions tab | —                        |
| `create-transaction.yaml`  | Create expense via FAB                  | Account exists           |
| `edit-transaction.yaml`    | Edit transaction amount                 | Transaction exists       |
| `edit-category-quick.yaml` | Quick-edit category from card           | Transaction exists       |
| `edit-amount-quick.yaml`   | Quick-edit amount from card             | Transaction exists       |
| `swap-account.yaml`        | Change account on edit screen           | 2+ accounts, transaction |
| `change-type.yaml`         | Change type Expense→Income              | Expense exists           |
| `delete-transaction.yaml`  | Delete with confirmation                | Transaction exists       |
| `search-filter.yaml`       | Search + type filter                    | Multiple transactions    |

## testID Reference

| testID                  | Component                           |
| ----------------------- | ----------------------------------- |
| `fab-button`            | Main FAB button                     |
| `fab-transaction`       | "Add Transaction" action            |
| `transaction-card-{id}` | Transaction card                    |
| `card-category-{id}`    | Category icon on card               |
| `card-amount-{id}`      | Amount area on card                 |
| `type-tab-{VALUE}`      | Type tabs (EXPENSE/INCOME/TRANSFER) |
| `header-save`           | Save button                         |
| `header-delete`         | Delete button                       |
| `header-back`           | Back button                         |
| `modal-confirm`         | Confirm button                      |
| `modal-cancel`          | Cancel button                       |
| `search-input`          | Search input                        |
| `filter-period`         | Period filter                       |
| `filter-type`           | Type filter                         |
