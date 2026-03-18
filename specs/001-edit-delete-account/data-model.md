# Data Model: Edit Account & Delete Account

**Date**: 2026-03-18 | **Branch**: `001-edit-delete-account`

## Existing Entities (NO schema changes)

### accounts

| Column     | Type          | Constraints             | Notes                     |
| ---------- | ------------- | ----------------------- | ------------------------- |
| id         | uuid          | PK                      | Auto-generated            |
| user_id    | uuid          | FK → profiles, NOT NULL | Owner                     |
| name       | text          | NOT NULL, max 50        | Editable                  |
| type       | account_type  | NOT NULL                | Read-only after creation  |
| currency   | currency_type | NOT NULL                | Read-only after creation  |
| balance    | numeric       | NOT NULL, default 0     | Editable (negative OK)    |
| is_default | boolean       | NOT NULL, default false | Editable (max 1 per user) |
| created_at | timestamptz   | NOT NULL                | Auto                      |
| updated_at | timestamptz   | NOT NULL                | Auto                      |
| deleted    | boolean       | NOT NULL, default false | Soft delete               |

**Relationships**:

- `bank_details` (1:many via account_id, but semantically 1:1 for BANK type)
- `transactions` (1:many via account_id)
- `transfers` (1:many via from_account_id AND to_account_id)
- `debts` (1:many via account_id)
- `recurring_payments` (1:many via account_id)

### bank_details

| Column          | Type        | Constraints             | Notes    |
| --------------- | ----------- | ----------------------- | -------- |
| id              | uuid        | PK                      |          |
| account_id      | uuid        | FK → accounts, NOT NULL |          |
| bank_name       | text        | nullable                | Editable |
| card_last_4     | text        | nullable, 4 digits      | Editable |
| sms_sender_name | text        | nullable                | Editable |
| created_at      | timestamptz | NOT NULL                |          |
| updated_at      | timestamptz | NOT NULL                |          |
| deleted         | boolean     | NOT NULL, default false |          |

### categories (existing, 2 new rows seeded)

| Column    | Type    | Notes                |
| --------- | ------- | -------------------- |
| id        | uuid    | PK                   |
| name      | text    | NOT NULL             |
| type      | text    | INCOME or EXPENSE    |
| level     | integer | 1 = main category    |
| is_system | boolean | true = non-deletable |
| parent_id | uuid    | nullable             |
| user_id   | uuid    | null for system cats |

## New Data (seeded via migration 032)

**Two system categories inserted**:

```sql
INSERT INTO categories (id, name, type, level, is_system, created_at, updated_at, deleted)
VALUES
  (gen_random_uuid(), 'Balance Adjustment (Income)', 'INCOME', 1, true, now(), now(), false),
  (gen_random_uuid(), 'Balance Adjustment (Expense)', 'EXPENSE', 1, true, now(), now(), false);
```

## New Constraint (migration 033)

**Partial unique index** — enforces max 1 default account per user:

```sql
CREATE UNIQUE INDEX idx_accounts_one_default_per_user
ON accounts (user_id)
WHERE is_default = true AND deleted IS DISTINCT FROM true;
```

## State Transitions

### Account Lifecycle

```
Created → [editable] → Deleted (soft)
                ↑
          Balance Changed → (silent update OR tracked transaction)
```

### Delete Cascade Order

```
Account (markAsDeleted)
  ├── bank_details        (markAsDeleted for each)
  ├── transactions        (markAsDeleted for each)
  ├── transfers           (markAsDeleted for from_account OR to_account match)
  ├── debts               (markAsDeleted for each)
  └── recurring_payments  (markAsDeleted for each)
```

## Validation Rules

| Field         | Rule                           | Error Message                                      |
| ------------- | ------------------------------ | -------------------------------------------------- |
| name          | required, 1-50 chars           | "Account name is required"                         |
| name          | unique per user + currency     | "An account named 'X' with Y already exists"       |
| balance       | valid number                   | "Balance must be a valid number"                   |
| cardLast4     | exactly 4 digits (if provided) | "Must be exactly 4 digits"                         |
| bankName      | max 50 chars (if provided)     | "Bank name must be less than 50 characters"        |
| smsSenderName | max 100 chars (if provided)    | "SMS sender name must be less than 100 characters" |
