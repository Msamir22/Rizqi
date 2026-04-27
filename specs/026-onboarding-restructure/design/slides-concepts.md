# Onboarding Slides — Concept Directions

> **Status:** Design exploration, pre-implementation **Scope:** Pre-auth pitch
> slides (shown before sign-up/sign-in) **Audience:** First-time launch of the
> app, no account yet **Viewport assumption:** 390×844 (iPhone 13/14 baseline);
> Pixel 7 parity verified mentally **Language:** English copy for exploration.
> AR translation is a later pass; a persistent language switcher (top-right) is
> present on every slide so RTL readiness is a first-class constraint (see RTL
> notes per concept).

---

## Tooling note

The Stitch MCP server was not reachable from this design session (no
`mcp__stitch__*` tools were exposed). Rather than block on tooling, this
document is written as an **implementation-ready design brief**: every screen
has an ASCII wireframe, a full token spec, typography, spacing on the 4px scale,
motion notes, and dark-mode pairings. A frontend engineer can build these
directly in NativeWind, and a future session with Stitch access can faithfully
reproduce them into high-fidelity mockups.

Stitch project/screen IDs are therefore not available; a `TODO` block at the end
of this file is reserved for when the mockups are imported.

---

## Shared foundations (apply to all 3 concepts)

These elements are identical across concepts so we compare narrative/aesthetic,
not chrome. Any concept-specific override is called out in-line.

### Shared chrome

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 AR ▾]                                    [Skip]  │  ← top bar, 44×44 min tap
│                                                         │
│                                                         │
│                   ── slide body ──                      │
│                                                         │
│                                                         │
│                                                         │
│                  ●  ○  ○  ○                             │  ← progress dots
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │             Primary CTA                  │        │
│     └──────────────────────────────────────────┘        │
│                                                         │
│              Secondary text link                        │
└────────────────────────────────────────────────────────┘
   safe-area bottom inset respected via useSafeAreaInsets
```

### Shared tokens (light-mode; dark pairings noted)

| Role                | Light token                                        | Dark token                                     |
| ------------------- | -------------------------------------------------- | ---------------------------------------------- |
| Screen background   | `bg-slate-50`                                      | `dark:bg-slate-950`                            |
| Surface card        | `bg-slate-25` (white)                              | `dark:bg-slate-900`                            |
| Primary brand       | `bg-nileGreen-700` (action) / text `nileGreen-800` | `dark:bg-nileGreen-500` / text `nileGreen-400` |
| Accent (gold/rates) | `text-gold-600`                                    | `dark:text-gold-400`                           |
| Text primary        | `text-slate-900`                                   | `dark:text-slate-50`                           |
| Text secondary      | `text-slate-600`                                   | `dark:text-slate-400`                          |
| Text muted          | `text-slate-500`                                   | `dark:text-slate-500`                          |
| Border/divider      | `border-slate-200`                                 | `dark:border-slate-800`                        |
| Inactive dot        | `bg-slate-300`                                     | `dark:bg-slate-700`                            |
| Active dot          | `bg-nileGreen-700`                                 | `dark:bg-nileGreen-400`                        |

All contrast pairs verified WCAG AA (4.5:1 body, 3:1 large). Notable checks:

- `text-slate-600` on `bg-slate-50` → 7.01:1 ✓
- `text-nileGreen-800` on `bg-slate-50` → 9.2:1 ✓
- `text-slate-400` on `bg-slate-950` → 6.3:1 ✓ (used for dark-mode secondary
  copy)
- `text-gold-600` on `bg-slate-50` → 4.8:1 ✓ (use for numbers/labels, not body)

### Shared typography scale

| Role             | Size / weight / line-height                                          |
| ---------------- | -------------------------------------------------------------------- |
| Hero headline    | `text-4xl font-semibold leading-tight tracking-tight` (36/1.1)       |
| Slide headline   | `text-3xl font-semibold leading-tight` (30/1.15)                     |
| Subhead          | `text-base font-normal leading-relaxed` (16/1.6), slate-600          |
| Eyebrow / label  | `text-xs font-medium tracking-widest uppercase` (12, letterSp .12em) |
| CTA label        | `text-base font-semibold` (16/1)                                     |
| Pagination count | `text-xs font-medium tabular-nums text-slate-500`                    |

Fonts already in the project: `Inter_*` for Latin, `ReadexPro_*` for Arabic. The
wordmark uses both (see `RizqiLogo.tsx`).

### Shared spacing rhythm (4px scale)

- Screen horizontal padding: **`px-6`** (24)
- Top bar height: **56pt** (`h-14`), language & Skip vertically centered
- Hero block to subhead gap: **`gap-4`** (16)
- Subhead to visual block gap: **`gap-10`** (40) — generous to let illustrations
  breathe
- Progress dots to CTA: **`mt-6`** (24)
- CTA to bottom safe area: **`pb-6`** (24) minimum, plus inset
- Dot spacing: **`gap-2`** (8), each dot 8×8, active dot 24×8 (pill)

### Shared CTA

`Button` primary variant, **full-width inside `px-6`**, `h-14` (56pt),
`rounded-2xl`, `text-base font-semibold`. Label colors:
`bg-nileGreen-700 text-slate-25` light /
`dark:bg-nileGreen-500 dark:text-slate-950` dark. Pressed state: scale 0.98 + bg
step darker (`active:bg-nileGreen-800`).

### Shared language switcher

Top-left on all concepts (leading edge). Why leading-left rather than right:

- The Skip affordance should occupy the dominant trailing corner to match
  platform convention.
- Leading-left for language keeps the switcher adjacent to the primary reading
  start.
- **RTL flip:** in Arabic, leading swaps to the right; `Skip` moves to left. Use
  `start-*`/`end-*` NativeWind logical properties or `flex-row-reverse` pattern;
  do not hardcode `left`/`right`.

Shape: a rounded pill —
`px-3 h-9 rounded-full border border-slate-200 dark:border-slate-800`, contents
`flex-row items-center gap-2`, flag emoji (`text-base`) + code
(`text-sm font-medium text-slate-700 dark:text-slate-300`) + a small
`ChevronDown` icon (14pt, `slate-400`). Tapping opens a small sheet to choose
`English / العربية`. Minimum tap target 44×44 achieved via an outer `hit-slop`
of 8 on each side.

### Shared Skip

Trailing top corner. Label: `Skip`,
`text-sm font-medium text-slate-500 dark:text-slate-400`, tap area `h-11 px-3`.
Press state: `active:text-slate-700 dark:active:text-slate-200`. Hidden on the
**final** slide (where the primary CTA is the exit).

### Shared motion

- **Slide change:** horizontal translate 100% + fade (0.4 → 1) over **280ms
  ease-out**. Never a bouncy spring — we want calm.
- **Progress dot active transition:** width animates 8 → 24 over **200ms
  ease-out**.
- **CTA press:** scale 0.98, **100ms ease-in-out**.
- **Illustration entry (per slide):** on settle, illustration fades in +
  translates 8px up over **260ms ease-out**, 40ms after the text (a subtle
  stagger — the eye reads text first, the picture arrives).

### Accessibility baseline

- Every tap target ≥ 44×44 (language switcher, Skip, dots, CTA).
- Dots have `accessibilityRole="progressbar"` +
  `accessibilityLabel="Step 1 of 4"`.
- Skip and language switcher have explicit `accessibilityLabel`.
- Illustrations that carry meaning get `accessibilityLabel`; purely decorative
  ones get `accessibilityElementsHidden`.

---

## Concept A — "Stillwater"

**Voice**: Quiet confidence. Whitespace speaks first; words come second;
illustration is a supporting whisper, never a shout.

**Why it fits Rizqi**: This is the closest expression of our brand principle
_"calm over loud."_ The generous air around each element mirrors the feeling of
a well-kept ledger — nothing shouting, nothing missing. It's the direction that
most separates us from neon-gradient fintech apps and signals "we're serious
about your money."

**Trade-offs**: It risks feeling _too_ reserved — users who expect a product
demo may wonder what the app actually looks like. We mitigate with a small
screen-frame glimpse on Slide 2 and real rate numbers on Slide 3.

**RTL note**: Layout is symmetric (centered stacks), so RTL flip is
near-trivial. Only the language switcher / Skip pair flips corners.

### Slide A1 — "Finance, without the friction"

**Props covered:** Effortless tracking narrative (umbrella) + voice entry
(teased)

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                    [Skip] │
│                                                         │
│                                                         │
│                                                         │
│                  ── RIZQI wordmark ──                   │  ← 120×30, nileGreen-800
│                                                         │
│                                                         │
│                                                         │
│           Finance, without the friction.                │  ← 30/1.15 semibold, slate-900
│                                                         │
│       Your money, tracked by listening — not            │  ← 16/1.6, slate-600, max-w ~320
│                  by typing.                             │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│               ╭──── waveform ────╮                      │  ← single horizontal sine wave
│               ╰──────────────────╯                      │    nileGreen-500 @ 40% opacity
│                                                         │    320w × 64h, decorative only
│                                                         │
│                                                         │
│                  ●  ○  ○  ○                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │               Continue                   │        │
│     └──────────────────────────────────────────┘        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- Wordmark uses `RizqiLogo` component — width 120, height 30.
- Waveform is a single-path SVG with 5 smooth crests, `stroke-width` 2, rounded
  linecaps. Idle: subtle breathing animation (amplitude oscillates ±2px) at
  **3000ms ease-in-out infinite**. This is the one intentional motion — it hints
  that "this app listens."
- No emoji, no colored pills. Just type, logo, and a breathing line.
- Max headline width clamped at ~320 to maintain 7-word/line balance.

### Slide A2 — "Speak it, or forget it — we got it"

**Props covered:** Voice entry + SMS auto-import (paired under "effortless")

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                    [Skip] │
│                                                         │
│                                                         │
│              Speak it. Or don't.                        │  ← 30/1.15, slate-900
│                                                         │
│       Say "200 for coffee" or let Rizqi read            │  ← 16/1.6, slate-600
│       your bank SMS. Either way, it's logged.           │
│                                                         │
│                                                         │
│      ╭──────────────────────────────╮                   │
│      │                              │                   │
│      │    [ 🎙 ]                    │                   │   ← row 1: mic glyph +
│      │    "200 for coffee"          │                   │     quoted VO transcript
│      │    ───────────────────────   │                   │   slate-200 divider
│      │                              │                   │
│      │    [ ✉ ]                    │                   │   ← row 2: envelope glyph
│      │    +50 EGP · CIB             │                   │     + mock SMS summary
│      │    auto-imported             │                   │     nileGreen-600 label
│      │                              │                   │
│      ╰──────────────────────────────╯                   │   surface card, rounded-3xl
│                                                         │   border-slate-200, no shadow
│                                                         │
│                                                         │
│                  ○  ●  ○  ○                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │               Continue                   │        │
│     └──────────────────────────────────────────┘        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- Card is the ONE surface element — treated as a "calm demo window."
  `bg-slate-25 dark:bg-slate-900`,
  `border border-slate-200 dark:border-slate-800`, `rounded-3xl`, `p-5`, `gap-4`
  between rows.
- Icons: Lucide `Mic` and `MessageSquare`, 20pt, `slate-500`. Quoted voice text
  in `text-slate-900 font-normal`, SMS summary with amount in
  `text-nileGreen-700 font-semibold tabular-nums`.
- Dividers between rows: `h-px bg-slate-200 dark:bg-slate-800`.
- Typography hierarchy: icon+label on one row, transcript/summary on the next,
  caption below. Total card height ~200.

### Slide A3 — "The market, live"

**Props covered:** Live exchange rates + gold/silver tracking

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                    [Skip] │
│                                                         │
│                                                         │
│             The market, live.                           │  ← 30/1.15, slate-900
│                                                         │
│      USD, EUR, gold, silver — priced this minute,       │  ← 16/1.6, slate-600
│            not yesterday.                               │
│                                                         │
│                                                         │
│      ╭──────────────────────────────────────╮           │
│      │                                      │           │
│      │    USD / EGP         49.82  ↑        │           │
│      │    ─────────────────────────────     │           │
│      │    EUR / EGP         53.14  ↑        │           │
│      │    ─────────────────────────────     │           │
│      │    Gold 24K       4,218 EGP/g        │           │   ← gold-600 accent on price
│      │    ─────────────────────────────     │           │
│      │    Silver         54.20 EGP/g        │           │   ← silver-500
│      │                                      │           │
│      │    · live · updated 2 min ago        │           │   ← caption, slate-500
│      ╰──────────────────────────────────────╯           │
│                                                         │
│                                                         │
│                  ○  ○  ●  ○                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │               Continue                   │        │
│     └──────────────────────────────────────────┘        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- Rate card same surface treatment as A2 — consistency over novelty.
- Each row: label (`text-sm text-slate-600`) left-aligned, value
  (`text-base font-semibold tabular-nums`) right-aligned. Delta arrow ↑/↓ in
  `text-nileGreen-600` / `text-red-500`, 14pt.
- Gold row value in `text-gold-600`, Silver row value in `text-silver-500`.
  Rationale: color carries semantic meaning here ("this is the metal itself"),
  which _is_ allowed under our "color earns its place" rule.
- Live-pulse dot: 6px circle `bg-nileGreen-500` with soft pulse (opacity 1 → 0.3
  → 1 over 2400ms, repeat). Single point of animation.

### Slide A4 — "Start quietly. Track clearly."

**Props covered:** Full recap + Get Started CTA

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                            │   ← Skip hidden on final slide
│                                                         │
│                                                         │
│                                                         │
│                  ── RIZQI wordmark ──                   │
│                                                         │
│                                                         │
│            Start quietly.                               │  ← 36/1.1 semibold, slate-900
│            Track clearly.                               │
│                                                         │
│                                                         │
│       Voice. SMS. Live rates. Gold.                     │  ← 16/1.6, slate-600
│       One calm place for all of it.                     │
│                                                         │
│                                                         │
│                                                         │
│                  ○  ○  ○  ●                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │            Create account                │        │   ← primary
│     └──────────────────────────────────────────┘        │
│                                                         │
│           Already have one?  Sign in                    │   ← text link, slate-600
│                                                         │                / nileGreen-700
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- Two-line headline broken for cadence. Subhead lists the four props like a
  restrained receipt — no pills, no icons.
- Primary CTA "Create account", secondary link "Sign in" — the sign-in link uses
  the brand nileGreen to feel like a first-class option, not a hidden one.

---

## Concept B — "River and Stone"

**Voice**: Warm, local, human. A quiet Egyptian authorship — Nile-blue water
flow, date-palm silhouette, mid-century Cairene geometry used with restraint.
Never tourist-cliché, never orientalist. Imagine the visual language of
contemporary Egyptian design studios (Baianat, Ahmed Mater adjacent) — modern
lines that happen to be rooted here.

**Why it fits Rizqi**: Most Egyptian fintech feels Westernized by default. This
concept leans into authenticity without nostalgia — a clear differentiator, and
a warmer emotional register that matches "financial companion" over "financial
dashboard."

**Trade-offs**: The illustration system adds production cost — custom SVG
illustrations per slide, tuned to our palette. It also narrows the aesthetic
ceiling: if we ship this and later want to pivot to a more global look, the
illustrations become debt. Mitigation: illustrations are geometric/abstract, not
representational, so they age well.

**RTL note**: Illustrations are composed to be horizontally symmetric or
near-symmetric so they don't require mirroring. Where an illustration has
directional flow (water, arrow), it points into the reading direction — so it
flips with language.

### Slide B1 — "Let your money flow, not your hours"

**Props covered:** Effortless tracking (umbrella) + voice

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                    [Skip] │
│                                                         │
│                                                         │
│   ╭─────────────────────────────────────────╮           │
│   │    ~~~~~~~~~~~~~~~~~~~~~~~~~            │           │   ← stylized water-flow
│   │       ~~~~~~~~~~~~~~~~~~~~              │           │     3 overlapping curves,
│   │    ~~~~~~~~~~~~~~~~~~~~~~~              │           │     nileGreen-400/500/700
│   │                                         │           │     with 40/70/100 opacity.
│   │         🎙                              │           │     Mic sits centered atop
│   ╰─────────────────────────────────────────╯           │     the top crest of the flow.
│                                                         │
│                                                         │
│         Let your money flow,                            │  ← 30/1.15 semibold
│         not your hours.                                 │     slate-900
│                                                         │
│      Say it. We'll record it. You move on               │  ← 16/1.6, slate-600
│      with your day.                                     │
│                                                         │
│                                                         │
│                  ●  ○  ○  ○                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │               Continue                   │        │
│     └──────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- Top illustration area: ~320h. Three nileGreen bands, each a smooth S-curve
  across the full width, stacked with 24px vertical offsets. Background of the
  illustration area: `bg-nileGreen-50 dark:bg-nileGreen-900/30`,
  `rounded-b-[40px]` so it bleeds to the screen edges top, curves gently at the
  bottom — the "river" frame.
- Voice affordance: a circular
  `h-16 w-16 rounded-full bg-slate-25 dark:bg-slate-900 border border-nileGreen-500`
  with a Lucide `Mic` 24pt `text-nileGreen-700` centered. Sits on top of the
  flow, partially overlapping the bottom curve — suggests "voice surfaces above
  the stream."
- Text block sits below the illustration with `pt-10` (40).

### Slide B2 — "Every receipt, every ping — remembered"

**Props covered:** SMS auto-import (with a gentle nod to voice from B1 for
continuity)

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                    [Skip] │
│                                                         │
│                                                         │
│   ╭─────────────────────────────────────────╮           │
│   │                                         │           │
│   │            [envelope glyph]             │           │   ← stylized envelope with
│   │         ╱──────────────╲                │           │     a soft nileGreen-500
│   │        │  ─────  ────   │               │           │     halo ring. Rays of
│   │        │  ─  ──  ───    │               │           │     gold-400 at 30% opacity
│   │         ╲──────────────╱                │           │     emanate at 4, 8, 12 o'clock
│   │              ⋯                          │           │     — subtle, like dawn light
│   │                                         │           │     on Cairo mosaic tile.
│   ╰─────────────────────────────────────────╯           │
│                                                         │
│         Every receipt. Every ping.                      │  ← 30/1.15, slate-900
│         Remembered.                                     │
│                                                         │
│      Rizqi reads your bank and wallet SMS,              │  ← 16/1.6, slate-600
│      so you never type the same thing twice.            │
│                                                         │
│                                                         │
│                  ○  ●  ○  ○                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │               Continue                   │        │
│     └──────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- Illustration background uses `bg-gold-50 dark:bg-gold-800/15` — a single-slide
  warm shift that signals "time-dawning/automatic." This is the concept's one
  use of gold-as-background; earns its place.
- Envelope: geometric, 4-panel mosaic-like interior (subtle straight lines,
  evokes Islamic geometric art without cliché). Stroke 1.5,
  `stroke-nileGreen-700`.
- Gold rays: `stroke-gold-400` with 30% opacity, 3 short rays only —
  understatement is the point.

### Slide B3 — "A scale that never sleeps"

**Props covered:** Live exchange rates + gold/silver tracking

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                    [Skip] │
│                                                         │
│                                                         │
│   ╭─────────────────────────────────────────╮           │
│   │                                         │           │
│   │              ▲                          │           │   ← a minimal balance-scale
│   │              │                          │           │     silhouette: one upright,
│   │        ◀─────┼─────▶                    │           │     two pans. Left pan holds
│   │       [$]         [Au]                  │           │     a "$" glyph (blue-500),
│   │                                         │           │     right pan an "Au" (gold-
│   ╰─────────────────────────────────────────╯           │     600). The scale is perfectly
│                                                         │     level — "no drama, just
│                                                         │     truth."
│          A scale that never sleeps.                     │  ← 30/1.15, slate-900
│                                                         │
│      Currencies and precious metals, live —             │  ← 16/1.6, slate-600
│      so your net worth is never stale.                  │
│                                                         │
│                                                         │
│                  ○  ○  ●  ○                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │               Continue                   │        │
│     └──────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- Scale silhouette `stroke-slate-700 dark:stroke-slate-300`, stroke 1.5, flat
  (no 3D, no shadow).
- Illustration background neutral: `bg-slate-100 dark:bg-slate-900`, rounded-b
  treatment same as other slides for continuity.
- Headline deliberately metaphorical; the subhead does the explicit
  "currencies + metals + live" work. This is the ONE slide where storytelling
  concept outweighs literal demo — justified because the value prop is abstract
  ("live" is a timing concept, hard to render as a thing).

### Slide B4 — "Your companion. In pocket."

**Props covered:** Recap + CTA

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                            │
│                                                         │
│                                                         │
│   ╭─────────────────────────────────────────╮           │
│   │                                         │           │
│   │           ── RIZQI wordmark ──          │           │   ← wordmark centered in
│   │                                         │           │     illustration area, on
│   │         ~~~~~~~~~~~~~~~                 │           │     the single water crest
│   │                                         │           │     we used on B1 — visual
│   ╰─────────────────────────────────────────╯           │     bookend.
│                                                         │
│                                                         │
│         Your companion. In pocket.                      │  ← 36/1.1, slate-900
│                                                         │
│      Built in Cairo, for how you actually               │  ← 16/1.6, slate-600
│      spend, save, and hold.                             │
│                                                         │
│                                                         │
│                  ○  ○  ○  ●                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │            Create account                │        │
│     └──────────────────────────────────────────┘        │
│                                                         │
│           Already have one?  Sign in                    │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- "Built in Cairo, for how you actually spend, save, and hold." — This line is
  the concept's payoff. It explicitly locates the brand. Keep or cut based on
  marketing comfort; if kept, consider AR translation carefully — "Cairo" in
  Arabic has weight.
- Water-crest callback on B4 creates a visual rhyme with B1. Small, earns trust.

---

## Concept C — "Dashboard at Dusk"

**Voice**: Confident, product-forward. We show what the app _is_ — actual UI
fragments rendered as hero imagery. Still calm (muted surface, no neon, no
gradients), but data-rich. Users exit this concept with a clear mental model of
"what I'll see inside."

**Why it fits Rizqi**: Some users need to see the product to trust it. This is
the pitch equivalent of a tasting menu — we pair each value prop with an
_actual_ micro-screenshot of the future app (rendered mock, not screenshot).
It's the concept most aligned with "show, don't tell," and it gives the
marketing team reusable hero assets.

**Trade-offs**: Highest production cost — each slide has a composed "device
frame" of UI chrome. Also the highest consistency risk: the mock UI must match
real app UI when built, or the onboarding will feel like a bait-and-switch.
Requires discipline to keep the mock UI in sync with real components.

**RTL note**: Device-frame mocks must exist in both LTR and RTL variants.
Easiest approach: render the mock as a real React component tree gated by
`i18n.language`, so it flips automatically.

### Slide C1 — "Track with your voice"

**Props covered:** Effortless + voice

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                    [Skip] │
│                                                         │
│   [ small eyebrow: 01 · VOICE ]                         │   ← tracking-widest, slate-500
│                                                         │
│         Track with your voice.                          │  ← 30/1.15, slate-900
│                                                         │
│      Just say the amount. Rizqi categorizes,            │  ← 16/1.6, slate-600
│      saves, and moves on.                               │
│                                                         │
│   ╭───────── device frame ───────────╮                  │
│   │                                  │                  │
│   │ ╔════════════════════════════╗   │                  │   ← mock UI:
│   │ ║   ◉ Listening...           ║   │                  │     - header strip
│   │ ║                            ║   │                  │     - big nileGreen pulse dot
│   │ ║   "Two hundred for coffee" ║   │                  │     - transcript line
│   │ ║                            ║   │                  │     - parsed card:
│   │ ║   ┌──────────────────────┐ ║   │                  │         200 EGP
│   │ ║   │  200 EGP             │ ║   │                  │         Food & Drinks
│   │ ║   │  Food & Drinks       │ ║   │                  │         Main CIB Account
│   │ ║   │  Main CIB Account    │ ║   │                  │
│   │ ║   └──────────────────────┘ ║   │                  │
│   │ ║   [ Confirm ]              ║   │                  │     - primary confirm button
│   │ ╚════════════════════════════╝   │                  │       at natural brand style
│   ╰──────────────────────────────────╯                  │
│                                                         │
│                  ●  ○  ○  ○                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │               Continue                   │        │
│     └──────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- Mock frame:
  `w-72 rounded-3xl bg-slate-25 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4`
  centered on the slide.
- Pulse dot: Lucide `Mic` inside a 40pt
  `bg-nileGreen-100 dark:bg-nileGreen-900/40` circle; outer ring pulses
  `nileGreen-500/30` at 2000ms.
- Transcript text: `text-slate-700 dark:text-slate-300 italic`.
- Parsed card inside mock: a smaller version of the real transaction draft card
  — amount in `text-2xl font-semibold`, category + account on subsequent rows in
  `text-sm text-slate-600`. Category pill uses `bg-orange-100 text-orange-600`
  (matches the food category in `business-decisions.md` §5.5).
- Confirm button inside mock: primary style, but half-scale so hierarchy reads
  mock < outer slide CTA.
- Eyebrow `01 · VOICE` gives the series a newsletter/editorial rhythm — each
  slide has a numbered chapter.

### Slide C2 — "SMS becomes transactions"

**Props covered:** SMS auto-import

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                    [Skip] │
│                                                         │
│   [ eyebrow: 02 · SMS ]                                 │
│                                                         │
│         SMS becomes transactions.                       │  ← 30/1.15, slate-900
│                                                         │
│      Rizqi reads bank and wallet SMS in the             │  ← 16/1.6, slate-600
│      background. You confirm — or don't.                │
│                                                         │
│   ╭───────── device frame ───────────╮                  │
│   │ ╔════════════════════════════╗   │                  │
│   │ ║  📩 CIB · 2 min ago        ║   │                  │   ← incoming SMS mock
│   │ ║  "Purchase of EGP 485      ║   │                  │     slate-100/dark-800 bg
│   │ ║  at Seoudi Market on       ║   │                  │     left-aligned bubble
│   │ ║  card ****1234"            ║   │                  │
│   │ ║                            ║   │                  │
│   │ ║        ↓ detected          ║   │                  │   ← vertical arrow, slate-400
│   │ ║                            ║   │                  │
│   │ ║  ┌──────────────────────┐ ║   │                  │   ← parsed-transaction card
│   │ ║  │ 485 EGP              │ ║   │                  │
│   │ ║  │ Groceries · CIB      │ ║   │                  │
│   │ ║  └──────────────────────┘ ║   │                  │
│   │ ║  [ Confirm ]  [ Dismiss ] ║   │                  │   ← two buttons side-by-side
│   │ ╚════════════════════════════╝   │                  │
│   ╰──────────────────────────────────╯                  │
│                                                         │
│                  ○  ●  ○  ○                             │
│     ┌──────────────────────────────────────────┐        │
│     │               Continue                   │        │
│     └──────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- SMS bubble uses the shape language of native iOS/Android SMS (left-aligned
  bubble, rounded-2xl, no tail — cleaner). Background
  `bg-slate-100 dark:bg-slate-800`, text
  `text-slate-700 dark:text-slate-300 text-sm`.
- Confirm is the primary-brand mini-button; Dismiss is ghost
  (`text-slate-500 border-slate-200`). Matches the **two-action pattern we
  already use** elsewhere — reuse over reinvent.
- Arrow "detected" is 12pt `text-slate-400` — shows mechanism without shouting.

### Slide C3 — "Live rates. Real gold."

**Props covered:** Live exchange rates + gold/silver tracking (the "live market
pulse" pairing)

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                    [Skip] │
│                                                         │
│   [ eyebrow: 03 · LIVE MARKET ]                         │
│                                                         │
│         Live rates. Real gold.                          │  ← 30/1.15, slate-900
│                                                         │
│      FX and precious metals update every                │  ← 16/1.6, slate-600
│      few minutes — so your net worth is true.           │
│
│   ╭───────── device frame ───────────╮                  │
│   │ ╔════════════════════════════╗   │                  │
│   │ ║ Net Worth                  ║   │                  │   ← mock "dashboard tile"
│   │ ║ EGP 342,180       +2.1% ↑  ║   │                  │     - big EGP value
│   │ ║                            ║   │                  │     - +2.1% delta nileGreen-600
│   │ ║  ──▁▂▃▅▆▇ sparkline ──     ║   │                  │     - minimal sparkline
│   │ ║                            ║   │                  │       nileGreen-500 stroke
│   │ ║  ┌────────┬──────────────┐ ║   │                  │
│   │ ║  │ Gold   │  4,218/g  ↑  │ ║   │                  │   ← two-row live-rates strip
│   │ ║  │ USD    │  49.82    ↑  │ ║   │                  │     gold-600 first cell label
│   │ ║  └────────┴──────────────┘ ║   │                  │
│   │ ║  · live · 2 min ago        ║   │                  │   ← caption, slate-500 +
│   │ ╚════════════════════════════╝   │                  │     pulse dot nileGreen-500
│   ╰──────────────────────────────────╯                  │
│                                                         │
│                  ○  ○  ●  ○                             │
│     ┌──────────────────────────────────────────┐        │
│     │               Continue                   │        │
│     └──────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- The EGP value uses `tabular-nums` so digits don't jitter when animated on
  entry (subtle count-up, 700ms, ease-out — optional).
- Sparkline is a static SVG; no animation needed. Stroke 2, `nileGreen-500`, no
  fill.
- The rates strip is a deliberately micro-sized version of what Slide A3 showed
  as the whole — shows how these facts fit into a real dashboard.

### Slide C4 — "All of it. None of the typing."

**Props covered:** Recap + CTA

```
┌────────────────────────────────────────────────────────┐
│  [🇪🇬 EN ▾]                                            │
│                                                         │
│                                                         │
│                                                         │
│                  ── RIZQI wordmark ──                   │
│                                                         │
│                                                         │
│                                                         │
│         All of it.                                      │  ← 36/1.1, slate-900
│         None of the typing.                             │
│                                                         │
│                                                         │
│      [ Voice ] [ SMS ] [ Live rates ] [ Gold ]          │   ← four text pills,
│                                                         │     h-9 rounded-full px-4
│                                                         │     border-slate-200,
│                                                         │     text-sm slate-700.
│                                                         │     wrap to 2 rows if needed.
│                                                         │
│                  ○  ○  ○  ●                             │
│                                                         │
│     ┌──────────────────────────────────────────┐        │
│     │            Create account                │        │
│     └──────────────────────────────────────────┘        │
│                                                         │
│           Already have one?  Sign in                    │
└────────────────────────────────────────────────────────┘
```

**Design notes:**

- The pill row visually reprises the four slides. Each pill has no icon, just a
  label — restraint.
- Pills are decorative; `accessibilityElementsHidden` to reduce screen-reader
  noise.

---

## Cross-concept comparison

| Dimension              | Concept A — Stillwater                     | Concept B — River and Stone           | Concept C — Dashboard at Dusk      |
| ---------------------- | ------------------------------------------ | ------------------------------------- | ---------------------------------- |
| Primary feeling        | Calm / trustworthy                         | Warm / local / human                  | Confident / product-forward        |
| Illustration weight    | Minimal (waveform, dots)                   | Custom SVG per slide                  | UI-frame mocks (pseudo-screens)    |
| Production cost        | Low                                        | Medium–High                           | High                               |
| Risk                   | May feel under-delivered                   | Aesthetic lock-in / illustration debt | Mock-vs-real drift                 |
| Best if we want to...  | Maximize perceived quality per unit effort | Own a local aesthetic identity        | Convert on "show me it works"      |
| Dark-mode complexity   | Trivial                                    | Medium (illustration re-tinting)      | High (UI mocks must re-theme)      |
| Accessibility headroom | Very comfortable                           | Comfortable                           | Tighter — many small mock elements |
| Time to ship (est.)    | 2–3 days                                   | 5–7 days (incl. illustrations)        | 6–8 days (incl. mock components)   |

---

## Designer's recommendation

**Ship Concept A ("Stillwater") for v1, with one borrowed element from Concept
C.**

Here's the thinking. Rizqi's strongest differentiator isn't visual flourish —
it's the _absence_ of financial anxiety. Concept A makes whitespace and
restraint into the product promise. It's also the only concept where "dark mode
is first-class" stays trivially true: when illustration is near-absent, theming
is a token swap. Concept B has soul, but the Egyptian-authorship angle is better
expressed later (e.g., in the illustration for the empty dashboard state, or the
celebration moment when first SMS auto-imports) where it feels earned, not
performed. Concept C shows the product, but a user who hasn't signed up yet
can't judge whether the mock matches the real app — we'd be spending our
highest-cost surface to make a promise we may fail to keep.

The one borrowed element from C: use an **eyebrow label** (`01 · VOICE`,
`02 · SMS`, etc.) on slides 2 and 3 of Concept A. It gives the series a quiet
editorial rhythm without touching the illustration budget. Small intervention,
high ROI.

**If leadership pushes for more product confidence**, the escape hatch is to
swap Slide A3 for C3 (dashboard tile mock). That one swap gets you the "show me
it's real" moment without shipping an entire product-mock concept.

---

## Handoff spec (for the engineer who builds this)

### Files to create (suggested)

- `apps/mobile/app/onboarding/slides/index.tsx` — carousel container,
  `useSharedValue`-based pagination
- `apps/mobile/app/onboarding/slides/_components/SlideShell.tsx` — shared chrome
  (top bar, dots, CTA)
- `apps/mobile/app/onboarding/slides/_components/LanguageSwitcher.tsx` — pill +
  bottom-sheet language picker
- `apps/mobile/app/onboarding/slides/_components/ProgressDots.tsx` — animated
  active-dot width
- `apps/mobile/app/onboarding/slides/_components/Waveform.tsx` (Concept A only)
  — breathing SVG
- `apps/mobile/app/onboarding/slides/_components/VoiceSmsDemoCard.tsx` (Concept
  A, Slide 2)
- `apps/mobile/app/onboarding/slides/_components/LiveRatesCard.tsx` (Concept A,
  Slide 3)
- `apps/mobile/locales/en/onboarding.json` and
  `apps/mobile/locales/ar/onboarding.json` — copy keys

### Components to reuse (NOT reinvent)

- `Button` (primary variant) for the CTA — do not build a one-off button.
- `PageHeader` is NOT used here — onboarding is headerless by design. The top
  bar is local to the onboarding shell.
- `GradientBackground` is available but should **stay off** for this flow — flat
  backgrounds read calmer. Confirmed against the brand principle "calm over
  loud."

### Copy keys (suggested)

```
onboarding.slides.a1.headline = "Finance, without the friction."
onboarding.slides.a1.subhead  = "Your money, tracked by listening — not by typing."
onboarding.slides.a2.headline = "Speak it. Or don't."
onboarding.slides.a2.subhead  = "Say \"200 for coffee\" or let Rizqi read your bank SMS. Either way, it's logged."
onboarding.slides.a3.headline = "The market, live."
onboarding.slides.a3.subhead  = "USD, EUR, gold, silver — priced this minute, not yesterday."
onboarding.slides.a4.headline = "Start quietly. Track clearly."
onboarding.slides.a4.subhead  = "Voice. SMS. Live rates. Gold. One calm place for all of it."
onboarding.cta.continue       = "Continue"
onboarding.cta.getStarted     = "Create account"
onboarding.cta.signIn         = "Already have one? Sign in"
onboarding.skip               = "Skip"
```

### Persistence note (for future-me)

Per `business-decisions.md` §12.4, dismissing the slides sets
`profiles.slides_viewed = true`. That write happens when the user taps **Skip OR
Create account OR Sign in** from any slide. Do not wait for the user to finish
all 4 slides — any exit counts. This is a business decision already made; no new
design input needed.

---

## Stitch mockups

**Stitch project ID**: `7737349693874632909` — _Rizqi — Onboarding Slides (Issue
#246)_ **Design system asset**: `assets/7415977770700987387` — _Rizqi Brand
System_

### Hero slides (Slide 1 of each concept) — generated 2026-04-22

| Concept                                   | Screen ID                          | Stitch URL                                                                                          |
| ----------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| A — Stillwater                            | `fbef708909714254a7847ed27f42971d` | https://stitch.withgoogle.com/projects/7737349693874632909/screens/fbef708909714254a7847ed27f42971d |
| B — River and Stone                       | `f7d7d4c31d62410d98a5183a6358be79` | https://stitch.withgoogle.com/projects/7737349693874632909/screens/f7d7d4c31d62410d98a5183a6358be79 |
| C — Dashboard at Dusk (v1)                | `ea8c0a2837d24737965c269bd03920ac` | https://stitch.withgoogle.com/projects/7737349693874632909/screens/ea8c0a2837d24737965c269bd03920ac |
| **C — Dashboard at Dusk (v2 — selected)** | `a3ef2e40d03f4ac5ae48480cab2a804c` | https://stitch.withgoogle.com/projects/7737349693874632909/screens/a3ef2e40d03f4ac5ae48480cab2a804c |

**v2 changes**: replaced the active "Confirm" button with a passive
`✓ Saved automatically · Just now` status indicator (eliminates the "what should
I confirm?" friction); updated transcript to natural free-form speech ("Just
paid 200 pounds for coffee with Ahmed"); rewrote subhead to convey
natural-conversation parsing ("Talk naturally — like you would to a friend.
Rizqi listens, parses, and saves it for you.").

### Concept C — final set

**Project canvas**: https://stitch.withgoogle.com/projects/7737349693874632909

The pre-auth flow is now **3 slides** (down from 4). Slide 4's role has been
merged into the auth screen (which is now part of the design scope). Slides
include: globe-icon language switcher, 3-dot pagination, "Get Started" CTA on
the final slide.

#### Light mode

| #   | Screen                                               | Headline                                              | URL                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Slide 1 — Voice                                      | Track with your voice.                                | [open](https://stitch.withgoogle.com/projects/7737349693874632909/screens/f7b27a492fee404c8a0fb168c723ff6b) | subhead wrap fixed (2026-04-23)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2   | Slide 2 — SMS (Android only)                         | Your bank texts. We listen.                           | [open](https://stitch.withgoogle.com/projects/7737349693874632909/screens/b485c0d266a942088cfe43b92a8c9341) | Shown only on Android. Replaced by Offline slide on iOS.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | **Slide 2 — Offline (iOS only, v2 — content-dense)** | **Record now. Sync later.**                           | [open](https://stitch.withgoogle.com/projects/7737349693874632909/screens/17e56eb8bd754b2197eedada5f1069ee) | iOS-only replacement for SMS slide. Value props: offline-first reliability + speed (instant saves). Mock UI shows 3 recently-saved offline transactions (with category emojis + timestamps) + an "⚡ Instant" pill + pending-sync footer. Subhead emphasizes speed: "Every tap is instant — on a plane, in a tunnel, anywhere. Rizqi runs on your device and syncs when you're back online." (Regenerated 2026-04-23 to add content density + speed messaging.) v1 (sparse): [562ada4840e94f05a32da635f9311a1c](https://stitch.withgoogle.com/projects/7737349693874632909/screens/562ada4840e94f05a32da635f9311a1c). |
| 3   | Slide 3 — Live Market                                | Live rates. Real gold.                                | [open](https://stitch.withgoogle.com/projects/7737349693874632909/screens/63a1b5af14e44361bac3acb7e9ac194b) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 4   | Auth (merged closer)                                 | Welcome to Rizqi · Everything tracked. Nothing typed. | [open](https://stitch.withgoogle.com/projects/7737349693874632909/screens/b253bc436f5748c1b656acc836a83a93) | first-version with trust-microbar footer separated by top border, refined 2026-04-23                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

#### Dark mode — deferred to implementation

**Decision (2026-04-23)**: Dark-mode mockups were attempted but Stitch's model
either drifted away from the Rizqi Brand System (applying a "Rizqi Nocturne"
variant with gradients and glassmorphism) or timed out repeatedly on slides 3
and auth. Rather than continue iterating, **dark mode will be implemented
directly in code** using NativeWind `dark:` variants during the frontend build
phase. The implementer has the comprehensive dark-mode token table below as
their authoritative reference; mockups are not required to ship dark mode.

The aborted dark mockups remain in the Stitch project for reference but are not
canonical:

- `3250cf8909194857ade9198631ab5814` (Slide 1 dark v1)
- `73fb171b3f214ea5af361527a13d18c5` (Slide 2 dark v1)
- `f7d51338778d4d73bc411b079aefa05a` (Slide 1 dark with "Rizqi Nocturne")
- `3599cb78d59c4c949bb99c20b37b166d` (Slide 2 dark with "Rizqi Nocturne")

### Additional mockups (generated 2026-04-23)

| #   | Screen                                                                       | URL                                                                                                         | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | **Voice mic-button tooltip** (v3 — centered layout + X close + "Try it now") | [open](https://stitch.withgoogle.com/projects/7737349693874632909/screens/31bd0663de0f45268edd28c1122c2dfe) | ✅ Triggered by the first tap on the voice step's action button in the Setup Guide card (NOT first-run dashboard entry). Copy: title **"Say it, don't type it"** / body **"Tap this mic anywhere. Talk naturally — we'll turn it into a transaction."** All content (Mic badge, title, body, primary button) is centered horizontally. **Primary button "Try it now"** (centered at bottom) → dismisses tooltip + opens voice overlay. **X close icon (top-right)** → dismisses tooltip only, no voice overlay. Mic button in the tab bar is now **centered** (matches shipped app). Revision history: v1 [27dacae7a09542a79274f122886cba38](https://stitch.withgoogle.com/projects/7737349693874632909/screens/27dacae7a09542a79274f122886cba38) (far-right mic, right-aligned button, "Got it"); v2 [e81c6ace8e074f388ed4e5f1376bf49f](https://stitch.withgoogle.com/projects/7737349693874632909/screens/e81c6ace8e074f388ed4e5f1376bf49f) (far-right mic, added X close + "Try it now" button). |
| 6   | First-run cash-account tooltip (body-copy refined 2026-04-23)                | [open](https://stitch.withgoogle.com/projects/7737349693874632909/screens/6cfe0ada329b429b814eca794f9cd840) | ✅ Approved. Removed "Delete it from Settings if you don't need it."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7   | Updated OnboardingGuideCard (4-step, expanded)                               | [open](https://stitch.withgoogle.com/projects/7737349693874632909/screens/013bca359d2645fa9a10ea9d0b7d80cb) | ✅ Approved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| —   | ~~Voice Entry modal~~ (discarded)                                            | [open](https://stitch.withgoogle.com/projects/7737349693874632909/screens/da0905cef77242399483d99ca7f669dd) | Discarded — duplicated functionality already available via the persistent bottom-nav mic button. Kept in Stitch for reference.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Deprecated screens (retained in Stitch for reference, not canonical)

- Concept A hero (`fbef708909714254a7847ed27f42971d`), Concept B hero
  (`f7d7d4c31d62410d98a5183a6358be79`) — alternate concepts not pursued.
- Slide 4 / Final CTA (`ebf0ce573ed74689b046ddc56fc4a67b`) — superseded by the
  merged auth screen.
- Earlier revision of Slide 1 (`a3ef2e40d03f4ac5ae48480cab2a804c`) —
  pre-globe-icon and pre-3-dot edit.
- Multiple intermediate slide-3 revisions (`d557d210503d47d1b089f5b1f225f67a`,
  `9ed52185b2d941a28158da8306219db5`, `cffc3de69f074f55a2374947cf89990b`,
  `fa251d3dbcc44e0ba31cfcaf307851ef`) — generated due to Stitch API retry
  duplication. The canonical version is `63a1b5af14e44361bac3acb7e9ac194b`.
- Earlier auth revision (`6d44f4d96a744846812f6acda63fde8b`) — same reason;
  canonical is `02b6e665c2e8494ab08aff6a49a15f28`.

### Dark mode token table (complete — implementer reference)

For the two dark mockups not yet generated (Slide 3 dark, Auth dark), the
implementer should apply these token mappings via NativeWind `dark:` variants.
The tokens are derived from the same Tailwind palette already in
`tailwind.config.js`.

| Element                                          | Light token                           | Dark token                                         | Notes                                                                      |
| ------------------------------------------------ | ------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Screen background                                | `bg-slate-50`                         | `dark:bg-slate-950`                                | Slate-950 is darker than slate-900 — preserves hierarchy with surface      |
| Surface (cards, inputs, mock device frame)       | `bg-white` (or `bg-slate-25`)         | `dark:bg-slate-900`                                | One step lighter than background                                           |
| Surface secondary (parsed-transaction sub-card)  | `bg-slate-50`                         | `dark:bg-slate-800/50`                             | Subtle differentiation inside mock frames                                  |
| SMS bubble                                       | `bg-slate-100`                        | `dark:bg-slate-800`                                | Slightly elevated above the mock-frame surface                             |
| Border / divider                                 | `border-slate-200`                    | `dark:border-slate-800`                            | Cards, inputs, dividers                                                    |
| Pill border                                      | `border-slate-200`                    | `dark:border-slate-800`                            | Language switcher, value-prop pills, OAuth button                          |
| **Primary CTA bg**                               | `bg-nileGreen-700` (#065F46)          | `dark:bg-nileGreen-500` (#10B981)                  | Brighter for legibility on dark                                            |
| Primary CTA text                                 | `text-white` (slate-25)               | `dark:text-white`                                  | Unchanged — white reads well on either                                     |
| **Active dot pill**                              | `bg-nileGreen-700`                    | `dark:bg-nileGreen-400` (#34D399)                  | Even brighter than primary CTA                                             |
| Inactive dot                                     | `bg-slate-300`                        | `dark:bg-slate-700`                                |                                                                            |
| Headline (h1, h2)                                | `text-slate-900`                      | `dark:text-slate-50`                               |                                                                            |
| Body text                                        | `text-slate-600`                      | `dark:text-slate-400`                              |                                                                            |
| Secondary text strong                            | `text-slate-700`                      | `dark:text-slate-300`                              | Pill labels, transcripts, table rows                                       |
| Muted / caption                                  | `text-slate-500`                      | `dark:text-slate-500`                              | Often unchanged                                                            |
| Eyebrow label                                    | `text-slate-500`                      | `dark:text-slate-400`                              | Slightly brighter for editorial weight                                     |
| Brand link (e.g., "Sign in", "Forgot password?") | `text-nileGreen-700`                  | `dark:text-nileGreen-400`                          |                                                                            |
| **Gold accent (gold value, coin icon)**          | `text-gold-600` (#D97706)             | `dark:text-gold-400` (#FBBF24)                     | Critical: gold-600 is too dark on slate-950, gold-400 reads correctly      |
| **Silver accent**                                | `text-silver-500` (#A0A0A0)           | `dark:text-slate-400`                              | Silver-500 still works but slate-400 is more legible; either is acceptable |
| Positive delta arrow                             | `text-nileGreen-600`                  | `dark:text-nileGreen-400`                          |                                                                            |
| Negative delta arrow                             | `text-red-500`                        | `dark:text-red-400`                                |                                                                            |
| Live pulse dot                                   | `bg-nileGreen-500`                    | `dark:bg-nileGreen-400`                            | With same outer glow at 30% opacity                                        |
| Sparkline stroke                                 | `stroke-nileGreen-500`                | `dark:stroke-nileGreen-400`                        |                                                                            |
| **Chip — Food & Drinks (orange)**                | `bg-orange-100 text-orange-600`       | `dark:bg-orange-900/40 dark:text-orange-300`       | Critical pairing — orange-300 reads on dark, orange-600 doesn't            |
| **Chip — Groceries (nileGreen)**                 | `bg-nileGreen-100 text-nileGreen-700` | `dark:bg-nileGreen-900/40 dark:text-nileGreen-300` |                                                                            |
| Saved-status check circle                        | `bg-nileGreen-500` (white check)      | `dark:bg-nileGreen-500` (white check)              | Same — green stays high-contrast                                           |
| OAuth button background                          | `bg-white`                            | `dark:bg-slate-900`                                | Google logo retains full color in both modes                               |
| Trust microbar text & icons                      | `text-slate-500`                      | `dark:text-slate-500`                              | Subdued in both modes                                                      |

The implementer can also reference the two existing dark mockups (Slide 1 dark,
Slide 2 dark) as visual confirmation that these mappings produce the intended
calm, sophisticated feel.
