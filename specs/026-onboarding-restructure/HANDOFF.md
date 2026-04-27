# Handoff — 026-onboarding-restructure

**Outgoing agent:** Claude Sonnet 4.5 **Handoff date:** 2026-04-24 **Git
branch:** `026-onboarding-restructure` **Worktree path:**
`E:/Work/My Projects/Rizqi/.claude/worktrees/beautiful-wu-306b86` **Worktree
type:** linked worktree (main checkout is `E:/Work/My Projects/Rizqi` on `main`)
**GitHub issue:** https://github.com/Msamir22/Rizqi/issues/246 (absorbs closed
#242, #243; bundles closed #245; depends on merged #226)

> The incoming agent MUST operate from the **Worktree path** above. If your
> session is not already there, `cd` into it before doing anything else. Do not
> create a new worktree or check the branch out elsewhere. The main checkout
> (`E:/Work/My Projects/Rizqi`) is on `main` and must stay untouched.

---

## Feature summary

Full restructure of Rizqi's onboarding experience. Pre-auth gets 3 pitch slides
(Voice → SMS/Offline → Live Market) in the device locale with a corner language
switcher; auth screen is redesigned to absorb the "slide 4 closer" (welcome +
tagline + value-prop pills + existing OAuth/email + trust microbar); post-auth
collapses to a single required Currency step that atomically creates the cash
account + writes preferred_currency + overwrites preferred_language + flips
`onboarding_completed = true`; the dashboard's first-run experience keeps the
existing SMS prompt unchanged and adds a new cash-account tooltip anchored to
the auto-created cash-account card; the Setup Guide card drops `cash_account`,
tightens the voice step's completion rule to `source = "VOICE"`, adds a
mic-button tooltip, and introduces a NEW badge; the dashboard cold-launch
skeleton drops the Setup Guide slot to kill the layout flash. Dark mode ships
via NativeWind `dark:` variants (no separate mockups). One new SQL migration
adds `profiles.onboarding_flags` as a JSONB column holding one-way boolean
tooltip markers.

---

## Spec artifacts

- Spec: `specs/026-onboarding-restructure/spec.md` — feature requirements
  (FR-001 through FR-040, 5 user stories, 10 success criteria). Clarifications
  embedded at top. **Implementation-detail-free** — framework names, file paths,
  and decorator names have been stripped; those live only in plan.md and below.
- Plan: `specs/026-onboarding-restructure/plan.md` — tech context, constitution
  check, project structure, 11 architectural decisions, test strategy,
  operational notes.
- Tasks: `specs/026-onboarding-restructure/tasks.md` — 82 tasks across 8 phases
  (Setup 6 · Foundational 17 · US1 14 · US2 15 · US3 7 · US4 10 · US5 3 · Polish
  10). Test tasks are inline (TDD mandatory per `CLAUDE.md`).
- Research: `specs/026-onboarding-restructure/research.md` — 11 resolved topics
  (atomic writes, JSONB-in-WMDB, AsyncStorage keys, BackHandler, AnchoredTooltip
  primitive, i18n RTL-reload behavior + startup-time override read,
  SMS-prompt-stays-outside-queue decision, FirstRunTooltipContext, voice-entry
  extraction, routing gate unchanged, dark-mode testing strategy).
- Data model: `specs/026-onboarding-restructure/data-model.md` — schema changes,
  AsyncStorage key catalogue, context value shape, routing contract, state
  transitions, invariants, sync behavior.
- Contracts: `specs/026-onboarding-restructure/contracts/` — `services.md`
  (every service/hook signature), `i18n-keys.md` (full key catalogue EN+AR),
  `onboarding-flags-schema.md` (JSONB contract + JSON Schema).
- Quickstart: `specs/026-onboarding-restructure/quickstart.md` — 13-phase
  implementer bootstrap with exact commit messages and manual-walkthrough test
  cases.
- Design artifacts:
  `specs/026-onboarding-restructure/design/slides-concepts.md` +
  `specs/026-onboarding-restructure/mockups/*.png` (authoritative for visual
  layout + dark-mode token table).

---

## Key decisions made during spec/plan/tasks

Non-obvious, session-specific, and easy to miss if you only read the three spec
files. Each bullet is self-contained.

### Routing signal — do NOT change `routing-decision.ts`

- The existing routing gate from #226 reads `profile.onboarding_completed`.
  **This is correct and must stay.**
- Early plan iteration considered swapping to `preferred_currency IS NULL`, but
  migration 042 made `profiles.preferred_currency` a
  `currency_type NOT NULL DEFAULT 'EGP'` enum column. It can never be null on a
  newly-inserted row, so it cannot distinguish "never onboarded" from "chose
  EGP."
- `confirmCurrencyAndOnboard` flips `onboarding_completed = true` inside the
  atomic write; the existing router consumes it correctly.
- Task T019 is a **verification-only** task (no code change). If
  `routing-decision.ts` or `app/index.tsx` has drifted, restore to the #226
  shape.

### Atomic Currency write

- `confirmCurrencyAndOnboard` must execute all four mutations (cash account
  create, `preferred_currency`, `preferred_language`,
  `onboarding_completed = true`) inside a single outer `database.write()`.
  WatermelonDB does not allow nested writers — the current
  `setPreferredCurrencyAndCreateCashAccount` works around this with two
  sequential writes, which breaks atomicity.
- Task T038 extracts a non-writer `createCashAccountWithinWriter` helper from
  `account-service.ts`; `ensureCashAccount` keeps its writer-owning public API
  so the 4 other callers (`batch-create-transactions.ts`,
  `sms-review-save-service.ts`, `transfer-service.ts`) stay unchanged.
- `preferred_language` is overwritten unconditionally with
  `getCurrentLanguage()` inside the write. The column is
  `NOT NULL DEFAULT 'en'`, so there's no nullness check. The runtime language
  already reflects any switches made on pitch/auth/Currency via the shared
  `LanguageSwitcherPill`.

### SMS prompt stays outside any queue (Option A, user-chosen)

- Existing `<SmsPermissionPrompt>` rendered by `(tabs)/index.tsx` via
  `useSmsSync()` has recurring-visibility semantics:
  `shouldShowPrompt = !wasPromptShown && !syncedBefore`. The prompt re-appears
  on every dashboard mount for Android users who have never dismissed and never
  synced. **This behavior must be preserved.**
- An earlier plan iteration proposed a `FirstRunTooltipQueue` component wrapping
  both the SMS prompt and the cash-account tooltip. The user rejected it —
  moving the SMS prompt's render site would break its existing recurring-render
  contract.
- Instead, the new `CashAccountTooltip` is self-gating:
  `visible = isFirstRunPending && !shouldShowPrompt && !onboarding_flags.cash_account_tooltip_dismissed`.
  The `!shouldShowPrompt` clause makes the cash tooltip wait for the SMS prompt
  to be dismissed (Android). No shared queue component exists.
- Do NOT introduce `FirstRunTooltipQueue`. This was explicitly rejected.

### Language-override persistence (FR-030)

- `@rizqi/intro-locale-override` is **never cleared** — not on sign-up, not on
  sign-out, not on Currency confirmation. It behaves as a device-level language
  preference.
- Earlier plan discussion worried about "contamination" for a second account on
  the same device. User pushed back: language pickers on auth and Currency step
  let any user correct it before confirming.
- `intro-flag-service.ts` must NOT export a `clearIntroLocaleOverride` helper.
  If a future feature genuinely needs to reset it, that helper can be added
  then.

### Startup-time language resolution (FR-002)

- `detectInitialLanguage()` in `apps/mobile/i18n/index.ts` must read
  `INTRO_LOCALE_OVERRIDE_KEY` FIRST, then device locale, then English. Without
  this fix, an RTL-triggered app reload shows a brief flash of device-locale
  content before `LanguageSwitcherPill`'s override applies.
- `initI18n()` MUST await this before `i18next.init()`. Task T009 is the fix.

### `onboarding_flags` JSONB storage pattern

- Follows the existing `profiles.notification_settings` precedent: JSONB on
  Supabase, `string` (stringified JSON) in WatermelonDB,
  `@field("onboarding_flags") onboardingFlagsRaw?: string` on the base model,
  and a typed `get onboardingFlags(): OnboardingFlags` getter on the extended
  model that `JSON.parse`s with a `{}` fallback.
- Rizqi's codebase does NOT use WatermelonDB's `@json` decorator — per-field
  manual parsing is the established pattern. Do not introduce `@json` just
  because it exists; follow the precedent.
- Keys are boolean and one-way: `cash_account_tooltip_dismissed` and
  `voice_tooltip_seen`. Missing key ≡ `false`. Once `true`, never `false`. Merge
  writes (never replace) to preserve existing keys. `setOnboardingFlag<K>`
  generic enforces this at the type level.

### Hardware back button behavior (FR-039, FR-013a, FR-040)

- Pitch slides: previous slide; slide 1 back exits (default).
- Cash-account tooltip: dismiss (same as "Got it" button).
- Mic-button tooltip: dismiss (same as X close — explicitly NOT "Try it now";
  does NOT open voice).
- Currency step: blocked unconditionally (`return true`).
- Auth screen: default `expo-router` back is fine.
- iOS has no hardware back; no iOS-only back affordances added.

### Mic-button tooltip flag semantics (FR-024a)

- `voice_tooltip_seen = true` is set on the FIRST tap of the voice step's action
  button, regardless of how the user dismisses (Try it now OR X). The tooltip is
  a one-time educational artifact — any subsequent action-button tap opens voice
  directly.
- Tapping the tab-bar mic button DIRECTLY never renders this tooltip (FR-024b).
  The tooltip is tied to the Setup Guide's voice-step action button, not to
  global mic-button behavior.
- Once the voice step completes (user records a voice-sourced transaction), the
  action button is removed from the card per existing completed-step rendering —
  the tooltip becomes non-retriggerable.

### Voice step completion rule tightened

- Previously: `count > 0` on transactions (any source counted).
- Now: `source === "VOICE" AND deleted !== true`. SMS-imported and
  manually-entered transactions do NOT satisfy this step.

### Spec.md implementation-detail hygiene

- The user explicitly called out (late in session) that implementation details
  were leaking into spec.md. I stripped them out in a dedicated pass. **Do NOT
  re-add them.** Framework names, file paths, component/hook/function names,
  AsyncStorage key literals, column-type details, migration file names, and
  decorator names all belong in plan.md / research.md / contracts, not spec.md.
- Key entity and business-field names (`preferred_currency`,
  `onboarding_completed`, `preferred_language`, `onboarding_flags`) are
  acceptable in spec.md — they are domain terms, not implementation details.

### Stitch mockup copy vs. spec copy

- Mockup `013bca359d2645fa9a10ea9d0b7d80cb` (Setup Guide card) renders older
  copy "Enable SMS auto-import." Spec (FR-022) defines the finalized label
  "Auto-track bank SMS." **Ship the spec's label, not the mockup's.** Similar
  note for FR-022: the mic button position in the mockup is right-aligned for
  layout clarity; the real app has it centered — `MicButtonTooltip` must anchor
  to the real rendered position.

### Dark mode approach

- NativeWind `dark:` variants applied at implementation time. No separate
  dark-mode mockups exist or are planned.
- `specs/026-onboarding-restructure/design/slides-concepts.md` contains the
  authoritative dark-mode token mapping table (surface, accents, chips, pulses,
  etc.).
- FR-036/037/038 are blocking quality gates — every new surface must pass
  dark-mode QA (Phase 8 T077).

### Explicitly eliminated from original scope

Do not re-introduce any of these during implementation:

- Multi-step post-auth wizard
- Step cursor in AsyncStorage (`onboarding:<userId>:step` is deprecated; leave
  the file in place but mark `@deprecated` per T076)
- "I'll do it later" button
- Back navigation between post-auth steps (there's only one post-auth step)
- Separate Language picker step (replaced by auto-detect + corner switcher)
- Cash-account confirmation step (replaced by first-run tooltip)
- Voice-first Add Transaction modal (replaced by mic-button tooltip on existing
  button)
- `FirstRunTooltipQueue` orchestrator component
- Clearing `@rizqi/intro-locale-override` on any code path

---

## Open questions / risks

### Out-of-scope follow-ups already agreed with user

- **Profile-name NOT NULL migration** (`first_name`, `last_name`, `display_name`
  columns on `profiles`): user chose option **(c)** — separate ticket, merge
  AFTER this feature. Do NOT bundle into 026. The incoming implementer should be
  aware that `handle_new_user()` + email-signup metadata + WatermelonDB model
  shape will need touching in that follow-up, but 026 assumes those columns stay
  nullable for now.
- **`profiles.slides_viewed` drop** — already shipped by migration 041 in
  feature 024. FR-032 is a no-op. Do not write another drop migration.

### Areas flagged for "revisit during implement"

- **`openVoiceEntry` extraction (T010)**: the exact current location of the
  tab-bar mic button's `onPress` handler was not fully read during planning.
  Research §9 documents the need to extract; the shape of the extraction (plain
  service function vs. provider/context) depends on what the handler actually
  looks like today. The implementer should read
  `apps/mobile/app/(tabs)/_layout.tsx` (and wherever the mic FAB lives) first,
  then pick the cleanest extraction pattern. Budget 30–60 minutes for this task;
  it's the one task where scope could grow.
- **Tab-bar mic button ref plumbing (T066)**: the `MicButtonTooltip` needs to
  measure the real rendered position of the mic button. If the tab bar is a
  stock expo-router tab component, exposing the button's ref via context or a
  provider may require a small refactor. Should be routine; flagging as a risk
  only because the spec/plan didn't read that specific file.
- **`AnchoredTooltip` primitive and the Android NativeWind v4 Modal bug**:
  research §5 references `.claude/rules/android-modal-overlay-pattern.md` as the
  safe pattern. Implementer should read that rule before writing
  `AnchoredTooltip`. If the absolute-overlay pattern has changed since the rule
  was last updated, follow the rule — it reflects the battle-tested solution.

### Genuinely open

- None that block implementation. All clarifications (5 during the
  `/speckit.clarify` pass + several mid-session) are captured in spec.md's
  Clarifications section or in the research.md Decisions.

---

## Anchors the incoming agent must respect

- Constitution: `.specify/memory/constitution.md` (highest authority — all 7
  principles, constitution check in plan.md passes)
- Project rules: `CLAUDE.md` at repo root (TDD mandatory, 80%+ coverage,
  NativeWind-only styling, offline-first, service-layer separation)
- Performance rules: `.claude/rules/performance-model-selection.md`
- RN+TS patterns: `.claude/rules/react-native-typescript.md`
- Skeleton loading rule: `.claude/rules/skeleton-loading.md`
- Android overlay pattern: `.claude/rules/android-modal-overlay-pattern.md`
  (required reading before building `AnchoredTooltip`)

---

## Session context worth carrying forward

- **User preference — pushback welcome**: The user explicitly asked for pushback
  during this session and pushed back on several plan drafts (routing-signal
  swap, FirstRunTooltipQueue, override-clearing). The user prefers
  straightforward "here's why this won't work" reasoning over deferential
  acceptance. Mirror this style.
- **User preference — speckit hygiene**: The user enforces the speckit
  convention that spec.md is WHAT/WHY only, plan.md holds HOW. The incoming
  agent should not let implementation details leak back into spec.md.
- **Commit discipline**: Each phase has a suggested commit message in
  quickstart.md / tasks.md. Use `feat(026): …`, `fix(026): …`, `docs(026): …`
  prefixes. One commit per task or per logical group within a phase.

---

## Next steps for the incoming agent

1. Read this entire file, then read `spec.md`, `plan.md`, and `tasks.md` end to
   end. Then `research.md`, `data-model.md`, `contracts/services.md`, and
   `quickstart.md` (the authoritative implementation bootstrap).
2. Read `CLAUDE.md` at repo root and `.specify/memory/constitution.md`.
3. Read `.claude/rules/android-modal-overlay-pattern.md` (required before Phase
   2 foundational work on `AnchoredTooltip`).
4. Run `/speckit.analyze` to produce a gap analysis across the three spec
   artifacts.
5. **Gap-handling protocol:**
   - If gaps are found and you are confident you can fill them without
     introducing new decisions the user should weigh in on (typo fixes,
     cross-doc reference drift, missed test coverage tasks, added coverage
     rows), fill them directly (edit `spec.md` / `plan.md` / `tasks.md` as
     appropriate), then re-run the analysis to confirm no gaps remain.
   - If any gap requires a judgment call the user should approve (ambiguous
     requirement, architectural trade-off, newly-surfaced scope question like
     the profile-name NOT NULL work), write
     `specs/026-onboarding-restructure/gap-analysis.md` describing each open
     item and STOP. Wait for user approval. Do not silently decide.
6. Once no gaps remain (or the user approves your resolutions), proceed to
   `/speckit.implement`. Start with Phase 1 (Setup, T001–T006) — migration +
   schema regen + model getter — then Phase 2 (Foundational) in parallel across
   the 10 `[P]` tasks.
7. Honor the no-change-to-routing-decision invariant (T019 is verification
   only). If the analyze pass suggests otherwise, re-read research §10 and this
   handoff's "Routing signal" bullet before touching anything.
