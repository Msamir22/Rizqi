import type { ParsedSmsTransaction } from "@astik/logic";
const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 86_400_000;
const TWO_DAYS_MS = 172_800_000;

export const MOCK_PARSED_TRANSACTIONS: ParsedSmsTransaction[] = [
  {
    amount: 550,
    currency: "EGP",
    type: "EXPENSE",
    counterparty: "Uber Egypt",
    date: new Date(),
    smsBodyHash: "mock-hash-1",
    senderDisplayName: "CIB",
    categoryId: "00000000-0000-0000-0001-000000000002",
    categoryDisplayName: "Transportation",
    rawSmsBody: "Transaction of 550 EGP at Uber with card 1234",
    confidence: 0.99,
    cardLast4: "1234",
  },
  {
    amount: 1500,
    currency: "EGP",
    type: "EXPENSE",
    counterparty: "Carrefour",
    date: new Date(Date.now() - ONE_HOUR_MS), // 1 hour ago
    smsBodyHash: "mock-hash-2",
    senderDisplayName: "NBE",
    categoryId: "f915b9f5-cc8e-45f4-91ff-c34ef8583807",
    categoryDisplayName: "Groceries",
    rawSmsBody: "Purchase at Carrefour for 1500 EGP",
    confidence: 0.95,
  },
  {
    amount: 1000,
    currency: "USD",
    type: "INCOME",
    counterparty: "Upwork Global",
    date: new Date(Date.now() - ONE_DAY_MS), // 1 day ago
    smsBodyHash: "mock-hash-3",
    senderDisplayName: "QNB",
    categoryId: "00000000-0000-0000-0001-000000000011",
    categoryDisplayName: "Salary & Income",
    rawSmsBody: "Received $1000 from Upwork",
    confidence: 0.9,
  },
  {
    amount: 2000,
    currency: "EGP",
    type: "EXPENSE",
    isAtmWithdrawal: true,
    counterparty: "ATM Withdrawal",
    date: new Date(Date.now() - TWO_DAYS_MS), // 2 days ago
    smsBodyHash: "mock-hash-4",
    senderDisplayName: "Banque Misr",
    categoryId: "cash-id",
    categoryDisplayName: "Cash Withdrawal",
    rawSmsBody: "ATM Cash withdrawal of 2000 EGP using card 5678",
    confidence: 0.99,
    cardLast4: "5678",
  },
];
