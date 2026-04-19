---
name: jest-testmatch-tsx-gotcha
description:
  "Jest testMatch *.test.ts silently excludes *.test.tsx — verify with npx jest
  --listTests"
user-invocable: false
origin: auto-extracted
---

# Jest `testMatch` silently excludes `.test.tsx`

**Extracted:** 2026-04-19 **Context:** Any Jest + TypeScript project that uses
both `.test.ts` (services, utils) and `.test.tsx` (React components).

## Problem

A `jest.config.js` like this:

```js
testMatch: ["<rootDir>/__tests__/**/*.test.ts"],
```

matches `foo.test.ts` but **NOT** `foo.test.tsx`. The `.tsx` extension has an
extra character the glob doesn't cover. Jest does not warn — the `.tsx` test
file is silently skipped. It compiles fine, ESLint is happy, the file shows up
in the `__tests__/` folder, and CI reports "all tests pass" — because none of
them ran.

Symptoms seen in the wild:

- PR review marks tests T024/T025 as "complete" because the files exist.
- Author's commit message acknowledges "tests crash, pre-existing, out of scope"
  — but doesn't realize they never ran in CI either.
- Regressions land because the only coverage for a state machine was in a file
  the runner ignores.

## Solution

### Fix the config

```js
testMatch: [
  "<rootDir>/__tests__/**/*.test.ts",
  "<rootDir>/__tests__/**/*.test.tsx",
],
```

Or, more concisely via brace expansion:

```js
testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
```

### Verify it

Never trust "the file is there, it must be running." Always confirm:

```bash
npx jest --listTests
```

Pipe to grep for the suspect file:

```bash
npx jest --listTests | grep -i MyComponent
```

If the file isn't listed, Jest is not running it — regardless of how green the
suite looks.

### Audit existing repos

Before merging any PR that claims "added X tests," run:

```bash
# Count .tsx test files on disk
find apps -name "*.test.tsx" | wc -l

# Count .tsx test files Jest picks up
npx jest --listTests | grep -c "\.test\.tsx$"
```

If these numbers disagree, `testMatch` is missing coverage.

## When to Use

Trigger conditions:

- Reviewing a PR that adds `.test.tsx` files for the first time in a repo that
  previously had only `.test.ts`.
- A TDD-mandated task claims coverage but a regression slips through.
- You see a commit message like "tests are broken, out of scope" for a file you
  can't locate in `jest --listTests` output.
- Auditing an Nx / Turborepo monorepo where each package has its own
  `jest.config.js` — mismatched `testMatch` glob is a common per-package drift.

Related anti-patterns to check while you're there:

- `testPathIgnorePatterns` accidentally covering `.tsx`.
- `preset: "jest-expo"` — jest-expo's default testMatch includes both, but a
  project override in `jest.config.js` silently overrides (not merges) the
  preset.
