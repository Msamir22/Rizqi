/**
 * Translation Schema Contract
 *
 * Defines the expected shape of translation files for type-safe i18n.
 * Each namespace has its own interface. The root TranslationResources
 * interface maps namespace names to their shapes.
 *
 * This file serves as a contract — all JSON translation files must
 * conform to these interfaces.
 */

/** Supported languages */
type SupportedLanguage = "en" | "ar";

/** Plural key suffixes for Arabic (simplified: singular, dual, other) */
interface PluralKeys {
  readonly _one: string;
  readonly _two: string;
  readonly _other: string;
}

/** Common namespace — shared across all screens */
interface CommonTranslations {
  // Buttons
  readonly save: string;
  readonly cancel: string;
  readonly delete: string;
  readonly edit: string;
  readonly add: string;
  readonly done: string;
  readonly skip: string;
  readonly next: string;
  readonly back: string;
  readonly confirm: string;
  readonly retry: string;
  readonly close: string;

  // Labels
  readonly loading: string;
  readonly error: string;
  readonly success: string;
  readonly empty_state: string;
  readonly search: string;
  readonly no_results: string;

  // Navigation
  readonly home: string;
  readonly accounts: string;
  readonly transactions: string;
  readonly metals: string;
  readonly settings: string;

  // Errors
  readonly error_generic: string;
  readonly error_network: string;

  // Currency
  readonly currency: string;

  // Dates (relative)
  readonly just_now: string;
  readonly minutes_ago: PluralKeys;
  readonly hours_ago: PluralKeys;
  readonly days_ago: PluralKeys;
}

/** Transactions namespace */
interface TransactionsTranslations {
  readonly add_transaction: string;
  readonly edit_transaction: string;
  readonly transaction_count: PluralKeys;
  readonly expense: string;
  readonly income: string;
  readonly transfer: string;
  readonly amount: string;
  readonly description: string;
  readonly category: string;
  readonly date: string;
  readonly from_account: string;
  readonly to_account: string;
  readonly no_transactions: string;
}

/** Accounts namespace */
interface AccountsTranslations {
  readonly add_account: string;
  readonly edit_account: string;
  readonly account_count: PluralKeys;
  readonly balance: string;
  readonly account_name: string;
  readonly account_type: string;
  readonly type_cash: string;
  readonly type_bank: string;
  readonly type_digital_wallet: string;
  readonly net_worth: string;
  readonly total_balance: string;
}

/** Settings namespace */
interface SettingsTranslations {
  readonly title: string;
  readonly language: string;
  readonly language_arabic: string;
  readonly language_english: string;
  readonly appearance: string;
  readonly dark_mode: string;
  readonly currency: string;
  readonly preferred_currency: string;
  readonly profile: string;
  readonly notifications: string;
  readonly logout: string;
  readonly sms_sync: string;
  readonly sync_new: string;
  readonly full_rescan: string;
  readonly live_detection: string;
  readonly auto_confirm: string;
}

/** Onboarding namespace */
interface OnboardingTranslations {
  readonly select_language: string;
  readonly welcome: string;
  readonly slide_1_title: string;
  readonly slide_1_description: string;
  readonly slide_2_title: string;
  readonly slide_2_description: string;
  readonly slide_3_title: string;
  readonly slide_3_description: string;
  readonly get_started: string;
  readonly select_currency: string;
}

/** Categories namespace — keyed by system_name */
interface CategoriesTranslations {
  readonly [systemName: string]: string;
}

/** Budgets namespace */
interface BudgetsTranslations {
  readonly create_budget: string;
  readonly edit_budget: string;
  readonly budget_count: PluralKeys;
  readonly budget_name: string;
  readonly budget_amount: string;
  readonly period: string;
  readonly daily: string;
  readonly weekly: string;
  readonly monthly: string;
  readonly quarterly: string;
  readonly yearly: string;
  readonly spent: string;
  readonly remaining: string;
  readonly over_budget: string;
}

/** Auth namespace */
interface AuthTranslations {
  readonly sign_in: string;
  readonly sign_up: string;
  readonly email: string;
  readonly password: string;
  readonly forgot_password: string;
  readonly continue_as_guest: string;
}

/** Metals namespace */
interface MetalsTranslations {
  readonly live_rates: string;
  readonly gold: string;
  readonly silver: string;
  readonly platinum: string;
  readonly palladium: string;
  readonly purity: string;
  readonly weight: string;
  readonly value: string;
}

/** Root translation resources type */
interface TranslationResources {
  readonly common: CommonTranslations;
  readonly transactions: TransactionsTranslations;
  readonly accounts: AccountsTranslations;
  readonly settings: SettingsTranslations;
  readonly onboarding: OnboardingTranslations;
  readonly categories: CategoriesTranslations;
  readonly budgets: BudgetsTranslations;
  readonly auth: AuthTranslations;
  readonly metals: MetalsTranslations;
}

export type {
  SupportedLanguage,
  PluralKeys,
  TranslationResources,
  CommonTranslations,
  TransactionsTranslations,
  AccountsTranslations,
  SettingsTranslations,
  OnboardingTranslations,
  CategoriesTranslations,
  BudgetsTranslations,
  AuthTranslations,
  MetalsTranslations,
};
