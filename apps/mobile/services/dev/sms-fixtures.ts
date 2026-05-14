/**
 * Dev-only SMS fixtures for the Live SMS Detection simulator.
 *
 * Each fixture is a realistic financial (or non-financial) SMS body used
 * to drive the same `onSmsReceived` pipeline the native Android
 * SmsBroadcastReceiver drives in production.
 *
 * Used exclusively by `apps/mobile/app/sms-simulator.tsx` and is guarded
 * by `__DEV__` at the call sites so it is tree-shaken in release builds.
 *
 * @module services/dev/sms-fixtures
 */

export interface SmsFixture {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly sender: string;
  readonly body: string;
}

export const SMS_FIXTURES: readonly SmsFixture[] = [
  {
    id: "nbe_debit_purchase",
    label: "NBE — Debit purchase (EGP)",
    description: "Standard NBE debit card purchase, happy path",
    sender: "NBE",
    body: "Purchase EGP 250.00 on card **** 4321 at CARREFOUR CAIRO on 08/04 14:23. Avail bal EGP 12,430.55",
  },
  {
    id: "cib_credit_payment",
    label: "CIB — Credit card payment",
    description: "CIB credit card charge",
    sender: "CIB",
    body: "CIB: EGP 1,299.00 charged on your credit card ending 9988 at AMAZON.EG on 08-APR-2026. Bal: EGP 4,201.00",
  },
  {
    id: "qnb_atm_withdrawal",
    label: "QNB — ATM withdrawal",
    description: "Exercises the ATM transfer branch in detection-handler",
    sender: "QNB",
    body: "QNB Alahli: ATM cash withdrawal EGP 2,000.00 from card **** 5566 on 08/04/2026 15:02. Avail bal EGP 8,000.00",
  },
  {
    id: "nbe_transfer_in",
    label: "NBE — Incoming transfer",
    description: "Income path",
    sender: "NBE",
    body: "NBE: Credit EGP 15,000.00 to your account **** 4321 via transfer from MOHAMED SAMIR on 08/04. New bal EGP 27,430.55",
  },
  {
    id: "usd_purchase",
    label: "CIB — USD purchase",
    description: "Multi-currency path",
    sender: "CIB",
    body: "CIB: USD 49.99 charged on your card **** 9988 at NETFLIX.COM on 08-APR-2026",
  },
  {
    id: "card_last4_match",
    label: "Card-last-4 matcher",
    description:
      "Forces the card-last-4 resolution branch in sms-account-matcher",
    sender: "NBE",
    body: "Purchase EGP 75.00 on card **** 1234 at STARBUCKS MAADI on 08/04 09:15. Avail bal EGP 5,200.00",
  },
  {
    id: "confirm_action_probe",
    label: "Confirm action probe",
    description: "Unique merchant used by E2E notification confirm tests",
    sender: "NBE",
    body: "Purchase EGP 91.23 on card **** 4321 at CONFIRM ACTION MARKET on 08/04 16:10. Avail bal EGP 12,339.32",
  },
  {
    id: "discard_action_probe",
    label: "Discard action probe",
    description: "Unique merchant used by E2E notification discard tests",
    sender: "NBE",
    body: "Purchase EGP 82.34 on card **** 4321 at DISCARD ACTION MARKET on 08/04 16:20. Avail bal EGP 12,256.98",
  },
  {
    id: "non_financial_spam",
    label: "Non-financial spam (should be filtered)",
    description: "Expected to be dropped by isLikelyFinancialSms",
    sender: "VODAFONE",
    body: "Your Vodafone data bundle will expire in 2 days. Renew now by dialing *888#",
  },
  {
    id: "duplicate_of_nbe_debit",
    label: "Duplicate of NBE debit (dedup test)",
    description:
      "Identical body to nbe_debit_purchase; second inject should be deduped",
    sender: "NBE",
    body: "Purchase EGP 250.00 on card **** 4321 at CARREFOUR CAIRO on 08/04 14:23. Avail bal EGP 12,430.55",
  },
];

export function getFixtureById(id: string): SmsFixture | null {
  return SMS_FIXTURES.find((f) => f.id === id) ?? null;
}
