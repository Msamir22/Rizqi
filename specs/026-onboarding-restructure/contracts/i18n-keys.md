# i18n Key Contract — Onboarding Restructure

**Feature**: 026-onboarding-restructure **Date**: 2026-04-23

Complete catalogue of i18n keys this feature adds, modifies, or removes. Each
key MUST exist in BOTH `locales/en/*.json` and `locales/ar/*.json` and MUST be
registered in `apps/mobile/i18n/translation-schemas.ts` so
`validateTranslationResources()` catches drift.

Arabic translations are illustrative — final Arabic copy should be reviewed by a
native speaker during implementation.

---

## Namespace: `onboarding`

### Pre-auth pitch slides

| Key                                       | English                                                                                                                   | Arabic (draft)                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pitch_slide_voice_headline`              | `Track with your voice.`                                                                                                  | `تتبع مصاريفك بصوتك.`                                                                            |
| `pitch_slide_voice_subhead`               | `Talk naturally — like you would to a friend. Monyvi listens, parses, and saves it for you.`                              | `تكلم كأنك بتتكلم مع صاحبك. رزقي يسمع، ويحفظها لك.`                                              |
| `pitch_slide_voice_listening`             | `Listening…`                                                                                                              | `بيسمع صوتك...`                                                                                  |
| `pitch_slide_voice_transcript`            | `I drank coffee for 40 pounds at Starbucks, bought clothes for 2000 pounds, and borrowed 500 pounds from Ahmed.`          | `شربت ب 40 جنيه قهوة في ستاربكس و اشتريت لبس ب 2000 جنيه واستلفت 500 جنيه من أحمد`               |
| `pitch_slide_voice_status_saved`          | `Saved automatically`                                                                                                     | `محفوظة تلقائيًا`                                                                                |
| `pitch_slide_voice_status_just_now`       | `Just now`                                                                                                                | `الآن`                                                                                           |
| `pitch_slide_voice_category_food`         | `Food & Drinks`                                                                                                           | `أكل وشرب`                                                                                       |
| `pitch_slide_voice_account`               | `Main CIB Account`                                                                                                        | `حسابي الأساسي في CIB`                                                                           |
| `pitch_slide_sms_headline`                | `Your bank texts. We listen.`                                                                                             | `رسائل بنكك، رزقي سامعها.`                                                                       |
| `pitch_slide_sms_subhead`                 | `Bank and wallet SMS get captured automatically — no copy-paste, no manual entry.`                                        | `رسائل البنك والمحفظة بتتسجل تلقائيًا — من غير نسخ ولا كتابة.`                                   |
| `pitch_slide_sms_bank_label`              | `CIB Bank · 2 min ago`                                                                                                    | `بنك CIB · من دقيقتين`                                                                           |
| `pitch_slide_sms_bank_body`               | `Purchase of EGP 485 at Seoudi Market on card ****1234`                                                                   | `مشتريات بمبلغ ٤٨٥ جنيه من Seoudi Market بكارت ****1234`                                         |
| `pitch_slide_sms_detected`                | `detected`                                                                                                                | `تم اكتشافها`                                                                                    |
| `pitch_slide_sms_category_groceries`      | `Groceries`                                                                                                               | `بقالة`                                                                                          |
| `pitch_slide_sms_status_imported`         | `Auto-imported`                                                                                                           | `مستوردة تلقائيًا`                                                                               |
| `pitch_slide_offline_headline`            | `Record now. Sync later.`                                                                                                 | `سجّل دلوقتي. المزامنة بعدين.`                                                                   |
| `pitch_slide_offline_subhead`             | `Every tap is instant — on a plane, in a tunnel, anywhere. Monyvi runs on your device and syncs when you're back online.` | `كل ضغطة لحظية — في الطيارة، في النفق، في أي مكان. رزقي شغال على جهازك ويزامن لما ترجع أونلاين.` |
| `pitch_slide_offline_status_offline`      | `Offline mode`                                                                                                            | `بدون انترنت`                                                                                    |
| `pitch_slide_offline_status_instant`      | `⚡ Instant`                                                                                                              | `⚡ لحظي`                                                                                        |
| `pitch_slide_offline_recently_added`      | `RECENTLY ADDED`                                                                                                          | `مضافة حديثًا`                                                                                   |
| `pitch_slide_offline_all_saved`           | `All saved instantly`                                                                                                     | `كلها محفوظة لحظيًا`                                                                             |
| `pitch_slide_offline_pending`             | `{{count}} pending`                                                                                                       | `{{count}} في الانتظار`                                                                          |
| `pitch_slide_live_market_headline`        | `Live rates. Real gold.`                                                                                                  | `أسعار مباشرة. ذهب حقيقي.`                                                                       |
| `pitch_slide_live_market_subhead`         | `USD, EUR, gold, silver — priced this minute, not yesterday. Your net worth always tells the truth.`                      | `الدولار، اليورو، الذهب، الفضة — بأسعار اللحظة. رصيدك الحقيقي دايمًا صادق.`                      |
| `pitch_slide_live_market_net_worth_label` | `NET WORTH`                                                                                                               | `صافي الثروة`                                                                                    |
| `pitch_slide_live_market_gold_label`      | `Gold 24K`                                                                                                                | `ذهب ٢٤`                                                                                         |
| `pitch_slide_live_market_silver_label`    | `Silver`                                                                                                                  | `فضة`                                                                                            |
| `pitch_slide_live_market_usd_label`       | `USD / EGP`                                                                                                               | `دولار / جنيه`                                                                                   |
| `pitch_slide_live_market_live_caption`    | `Live · Updated {{minutes}} min ago`                                                                                      | `مباشر · محدث من {{minutes}} دقيقة`                                                              |

### Pitch chrome

| Key                 | English          | Arabic (draft)    |
| ------------------- | ---------------- | ----------------- |
| `pitch_skip`        | `Skip`           | `تخطي`            |
| `pitch_continue`    | `Continue`       | `متابعة`          |
| `pitch_get_started` | `Get Started`    | `هيا بنا`         |
| `pitch_back`        | `Previous slide` | `الشريحة السابقة` |

> Note: the language switcher pill is rendered as a globe icon + the raw
> 2-letter ISO code (`EN` / `AR`) by `LanguageSwitcherPill.tsx` directly — those
> literals are NOT translated, so no `pitch_language_switcher_*` keys exist in
> the locale files. The earlier draft of this contract listed two such keys;
> they were never wired up and are now removed from the contract to match.

### Currency step

| Key                           | English                                                                              | Arabic (draft)                                         |
| ----------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `currency_step_title`         | `Choose your primary currency`                                                       | `اختر العملة الأساسية`                                 |
| `currency_step_subtitle`      | `This is the currency of your first account. You can change it later from Settings.` | `دي عملة حسابك الأول. تقدر تغيرها بعدين من الإعدادات.` |
| `currency_step_confirm`       | `Confirm`                                                                            | `تأكيد`                                                |
| `currency_step_signout`       | `Sign out`                                                                           | `تسجيل الخروج`                                         |
| `currency_step_error_generic` | `Something went wrong. Please try again.`                                            | `حصل خطأ. حاول تاني.`                                  |

### Setup Guide card (updated)

| Key                                   | English                 | Arabic (draft)              | Status                                                 |
| ------------------------------------- | ----------------------- | --------------------------- | ------------------------------------------------------ |
| `setup_guide`                         | `Setup Guide`           | `خطوات البداية`             | unchanged                                              |
| `onboarding_step_bank_account`        | `Add bank account`      | `أضف حساب بنكي`             | unchanged                                              |
| `onboarding_step_voice_transaction`   | `Try voice transaction` | `جرب التسجيل بالصوت`        | **NEW** (replaces `onboarding_step_first_transaction`) |
| `onboarding_step_auto_track_bank_sms` | `Auto-track bank SMS`   | `تتبع رسائل البنك تلقائيًا` | **NEW** (replaces `onboarding_step_sms_import`)        |
| `onboarding_step_spending_budget`     | `Set a budget`          | `حدد ميزانية`               | unchanged                                              |
| `go`                                  | `GO`                    | `ابدأ`                      | unchanged                                              |
| `new_badge`                           | `NEW`                   | `جديد`                      | unchanged                                              |
| `dismiss`                             | `Dismiss`               | `تجاهل`                     | unchanged                                              |
| `next`                                | `Next`                  | `التالي`                    | unchanged                                              |

### Removed from this namespace

- `onboarding_step_cash_account` — step removed (always complete after
  Currency).
- `onboarding_step_first_transaction` — renamed to
  `onboarding_step_voice_transaction`.
- `onboarding_step_sms_import` — renamed to
  `onboarding_step_auto_track_bank_sms`.

### First-run dashboard tooltips

| Key                             | English                                                                     | Arabic (draft)                                                         |
| ------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `cash_account_tooltip_title`    | `We set this up for you`                                                    | `جهّزنا ده ليك`                                                        |
| `cash_account_tooltip_body`     | `We created a default cash account so you can start tracking right away.`   | `أنشأنالك حساب كاش علشان تقدر تبدأ على طول.`                           |
| `cash_account_tooltip_got_it`   | `Got it`                                                                    | `تمام`                                                                 |
| `mic_button_tooltip_title`      | `Say it, don't type it`                                                     | `قولها، متكتبش`                                                        |
| `mic_button_tooltip_body`       | `Tap this mic anywhere. Talk naturally — we'll turn it into a transaction.` | `دوس على المايك من أي مكان في التطبيق. اتكلم طبيعي — هنحولها لمعاملة.` |
| `mic_button_tooltip_try_it_now` | `Try it now`                                                                | `جربها دلوقتي`                                                         |

---

## Namespace: `auth`

### Welcome + tagline + pills

| Key                    | English                              | Arabic (draft)               |
| ---------------------- | ------------------------------------ | ---------------------------- |
| `welcome_title`        | `Welcome to Monyvi`                  | `أهلًا بك في رزقي`           |
| `welcome_tagline`      | `Everything tracked. Nothing typed.` | `كل حاجة متتبعة. ولا كتابة.` |
| `pill_voice`           | `Voice`                              | `صوت`                        |
| `pill_bank_sms`        | `Bank SMS`                           | `رسائل البنك`                |
| `pill_live_rates`      | `Live rates`                         | `أسعار مباشرة`               |
| `pill_gold_silver`     | `Gold & silver`                      | `ذهب وفضة`                   |
| `continue_with_google` | `Continue with Google`               | `المتابعة باستخدام جوجل`     |
| `or`                   | `— or —`                             | `— أو —`                     |
| `email_label`          | `Email`                              | `البريد الإلكتروني`          |
| `email_placeholder`    | `you@example.com`                    | `you@example.com`            |
| `password_label`       | `Password`                           | `كلمة المرور`                |
| `forgot_password`      | `Forgot password?`                   | `نسيت كلمة المرور؟`          |
| `sign_up`              | `Sign up`                            | `إنشاء حساب`                 |
| `sign_in`              | `Sign in`                            | `تسجيل الدخول`               |
| `already_have_account` | `Already have an account?`           | `عندك حساب بالفعل؟`          |
| `trust_encrypted`      | `Encrypted`                          | `مشفّر`                      |
| `trust_private`        | `Private`                            | `خاص`                        |

### Removed from this namespace

- `welcome_subtitle` — replaced by `welcome_tagline`.
- `trust_backed_up` — the three-badge row is removed; this badge is no longer
  shown.

---

## Namespace: `common` (any shared new keys — minimal expected)

No new keys expected in `common`. Existing `error_generic`, `error`, `next`,
`back`, `cancel`, `got_it` are reused.

---

## Registration in `translation-schemas.ts`

Each new key above MUST appear in the schema validator. Pseudo-structure:

```ts
// apps/mobile/i18n/translation-schemas.ts (additions)
export interface OnboardingSchema {
  // ...existing keys...

  // Pitch slides (added) — eyebrow keys removed 2026-04-26 per design
  // simplification (no numbered "01 · VOICE" eyebrow on slides anymore).
  pitch_slide_voice_headline: string;
  // ... (all new keys above)

  // Currency step
  currency_step_title: string;
  // ...

  // Tooltips
  cash_account_tooltip_title: string;
  // ...
}

export interface AuthSchema {
  // ...existing keys...

  welcome_title: string;
  welcome_tagline: string; // replaces welcome_subtitle
  pill_voice: string;
  // ...
  trust_encrypted: string;
  trust_private: string;
  // trust_backed_up removed
}
```

`validateTranslationResources()` runs at app startup and throws a loud error if
any key is missing from either locale. This is the safety net.

---

## RTL considerations

- All pitch slide layouts use NativeWind `start-*` / `end-*` logical properties
  (not `left-*` / `right-*`).
- The numbered eyebrow labels (`01 · VOICE`, etc.) were removed in the
  2026-04-26 design pass; pitch slides now lead directly with the headline.
- Auth-screen value-prop pills are rendered as `<Icon> + <label>` pairs in code;
  the i18n strings carry **only** the localized noun (no leading emoji), and the
  glyph is sourced from `@expo/vector-icons` so the pill renders consistently in
  both LTR and RTL without depending on the platform emoji font.
