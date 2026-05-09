---
name: source-command-code-review
description:
  Comprehensive Monyvi branch or PR code review and remediation workflow. Use
  when the user asks to run the migrated source command `code-review`, review a
  current branch or pull request, audit changes against the Monyvi constitution,
  `.agent/rules`, feature specs, mockups, automated review comments, and then
  implement fixes on a follow-up branch or PR.
---

# source-command-code-review

Use this skill when the user asks to run the migrated source command
`code-review`.

This workflow reviews the user's active branch or pull request, produces
specific blocking and non-blocking feedback, then applies the necessary fixes on
a follow-up branch targeting the user's original work.

Every numbered section is mandatory. If a section does not apply, explicitly
write `N/A - <reason>` in the report.

## 1. Context Gathering

Before reviewing code, load all required project context.

### 1.1 Constitution

Read `.specify/memory/constitution.md`.

Treat it as the highest authority. It supersedes ad-hoc instructions and must be
enforced strictly.

### 1.2 Project Rules

Read every Markdown file under `.agent/rules/`.

List the rule files read in the review report as proof of compliance. Treat
these files as implementation standards for all changed files.

### 1.3 Feature Specs

Identify the current branch name, then locate the matching folder under
`specs/`.

Preferred mapping: `specs/<branch-name>/`.

If there is no exact match, search for the closest active spec folder and state
the fallback clearly. Read every Markdown file in the selected folder, including
`spec.md` or `spc.md`, `plan.md`, `tasks.md`, and any additional `.md` files.

Treat specs as the source of truth for feature requirements.

## 2. Code Analysis

Identify the target branch or pull request and extract the full changed-file
list and diff before opening implementation files.

Every subsection below must produce output in the report. If no issue is found
for a subsection, write `No violations found`.

### 2.1 Constitution Compliance

For every changed file, identify which constitution principles apply and
validate strict compliance.

Produce a PASS/FAIL checklist for these eight checks:

1. Architecture and data flow
   - Offline-first behavior uses WatermelonDB first and network second.
   - Core calculations do not depend on API availability.
   - Required sync fields exist where applicable.
2. Business logic
   - Behavior matches `docs/business/business-decisions.md`.
   - No undocumented or assumed financial rules are introduced.
3. Type safety
   - No `any`.
   - All functions have explicit return types.
   - No unsafe non-null assertions.
   - External data is validated with Zod where applicable.
4. Layer separation
   - No business logic in components or lifecycle hooks.
   - Database writes live in services or repositories.
   - Shared logic stays in `packages/logic`.
5. UI and styling
   - NativeWind classes are used correctly.
   - No hardcoded colors.
   - No invalid `isDark` styling ternaries.
   - UI fields match the actual schema.
6. Monorepo boundaries
   - Dependency direction remains `apps -> packages/logic -> packages/db`.
   - Package imports do not reverse boundaries.
7. Database and migrations
   - Schema changes use local SQL migrations in `supabase/migrations/`.
   - Generated schema and migration outputs are committed when required.
8. Code quality
   - No magic numbers or hardcoded business strings.
   - Tech debt is marked with `// TODO:`.
   - Naming conventions are followed.
   - No production `console.log`.

Any constitution violation makes the reviewed work not approvable until fixed.

### 2.2 Specs Compliance

Verify code against `spec.md` or `spc.md`, `plan.md`, and `tasks.md`.

Go through every task in `tasks.md` line by line and mark it:

```markdown
- [x] Task description - IMPLEMENTED in <file>
- [ ] Task description - NOT IMPLEMENTED - <reason>
- [~] Task description - PARTIALLY IMPLEMENTED - <what is missing>
```

Check for missing functionality, incomplete tasks, deviations from the plan, and
changes under the wrong spec folder.

If any task is not implemented and not explicitly justified, the reviewed work
is not approvable.

### 2.3 Rules Compliance

For every changed file, identify the relevant `.agent/rules/*.md` files and
validate compliance.

Each rules finding must cite the specific rule file, for example:
`.agent/rules/tailwindcss-best-practices.md`.

Check for rule violations, missing required patterns, incorrect implementations,
inconsistencies, and bypassed project standards.

### 2.4 Spec Quality and Completeness

Review the specs themselves, not only the implementation.

Detect missing requirements, undocumented edge cases, implicit behavior that
appears in code but not in specs, UX gaps, validation gaps, error-handling gaps,
data constraints, and performance requirements that should have been specified.

Also compare spec, plan, and tasks for:

1. Spec to plan gaps.
2. Plan to tasks gaps.
3. Spec to tasks gaps.
4. Conflicting names, data structures, flows, or definitions.

Use this format for spec-level issues:

```markdown
- Spec Gap: <title>
  - Files: `spec.md` / `plan.md` / `tasks.md`
  - Issue: <inconsistency or missing linkage>
  - Fix: <required alignment>

- Missing Requirement: <title>
  - File: `spec.md`
  - Gap: <what is missing>
  - Suggestion: <what should be added>
```

Critical spec gaps that can lead to incorrect or incomplete implementation make
the reviewed work not approvable.

### 2.5 Mockups Compliance

Locate `specs/<branch-name>/mockups/`.

If the folder does not exist, write `No mockups found - N/A`. If it exists, load
every mockup image and compare each one against the corresponding component or
screen implementation.

For each mockup, validate all seven categories:

1. Layout and structure.
2. Spacing and alignment.
3. Typography.
4. Colors and theming.
5. Components and UI elements.
6. States.
7. Interactions.

Use this table for every mockup:

```markdown
#### Mockup: <filename>

Corresponds to: <component or screen>

| Check                 | Status    | Notes |
| --------------------- | --------- | ----- |
| Layout and Structure  | PASS/FAIL | ...   |
| Spacing and Alignment | PASS/FAIL | ...   |
| Typography            | PASS/FAIL | ...   |
| Colors and Theming    | PASS/FAIL | ...   |
| Components and UI     | PASS/FAIL | ...   |
| States                | PASS/FAIL | ...   |
| Interactions          | PASS/FAIL | ...   |
```

Mockup deviations make the reviewed work not approvable. Fix UI changes to match
mockups without inventing new design decisions.

### 2.6 General Best Practices

Review beyond the constitution and rules for:

- React Native and Expo best practices.
- TypeScript strict-mode correctness.
- SOLID and clean-code violations.
- Duplication that creates real maintenance risk.
- Performance issues such as avoidable re-renders, missing cleanup, or N+1
  queries.
- Accessibility gaps.

### 2.7 Automated Review Comments

If reviewing a PR, fetch existing review comments and bot comments from tools
such as CodeRabbit, SonarCloud, ESLint bots, or CI annotations.

For each bot finding, explicitly categorize it:

- `Accept` - include it in the fix plan.
- `Defer` - add or preserve a `// TODO:` with justification.
- `Reject` - explain why it is incorrect or out of scope.

Avoid duplicate fixes.

## 3. Review Report Format

Lead with findings, ordered by severity. Use file and line references whenever
possible. In Codex app reviews, emit `::code-comment{...}` directives for
actionable inline findings when the user asked for comments or PR-style review.

Use these report sections:

```markdown
## Context Loaded

- Constitution: `.specify/memory/constitution.md`
- Rules read: <list>
- Spec folder: `specs/<branch-name>`
- Target diff: <branch or PR>

## Constitution Checklist

| Check                      | Status    | Notes |
| -------------------------- | --------- | ----- |
| Architecture and Data Flow | PASS/FAIL | ...   |
| Business Logic             | PASS/FAIL | ...   |
| Type Safety                | PASS/FAIL | ...   |
| Layer Separation           | PASS/FAIL | ...   |
| UI and Styling             | PASS/FAIL | ...   |
| Monorepo Boundaries        | PASS/FAIL | ...   |
| Database and Migrations    | PASS/FAIL | ...   |
| Code Quality               | PASS/FAIL | ...   |

## Findings

### Constitution Violations

- Violation: <title>
  - Principle: <constitution principle>
  - Location: <file + line>
  - Issue: <explanation>
  - Fix: <concrete solution>

### Rules Violations

- Violation: <title>
  - Rule: `.agent/rules/<file>.md`
  - Location: <file + line>
  - Issue: <explanation>
  - Fix: <suggestion>

### Specs Violations

- Violation: <title>
  - Spec: `spec.md` / `plan.md` / `tasks.md`
  - Location: <file + line>
  - Issue: <missing or incorrect implementation>
  - Fix: <required implementation>

### Mockup Violations

- Mockup Violation: <title>
  - Mockup: `<mockup file name>`
  - Location: <file + line>
  - Issue: <difference from mockup>
  - Fix: <exact change required>

### Improvements

- Improvement:
  - Reference: <rule or principle if applicable>
  - Suggestion: <actionable suggestion>

## Task Verification

<line-by-line task status from `tasks.md`>

## Automated Comments

<Accept/Defer/Reject list, or N/A>

## Approval Verdict

APPROVABLE or NOT APPROVABLE, with the blocking reasons.
```

## 4. Implement Fixes

After reporting findings, create a fix branch from the user's branch:

```bash
git switch -c agent-fixes/<original-branch-name>
```

Apply all required fixes for:

- Constitution violations.
- Spec gaps and incomplete tasks.
- Rules violations.
- Mockup violations.
- Accepted automated findings.

Keep fixes surgical. Do not refactor unrelated code. Preserve user changes you
did not make.

Verify with focused tests and checks that would have caught the original issues.
For UI fixes, use the best available visual validation path.

## 5. Create Fix Pull Request

When the repository and credentials allow it, push the fix branch and create a
pull request with the base set to the user's original branch, or `main` if the
original branch was already merged.

The PR description must include:

- Checklist of fixes.
- Summary of violations resolved.
- Notes on deferred or rejected automated comments.
- Verification commands run and their results.

If push or PR creation is blocked by environment, permissions, missing remote,
or missing GitHub authentication, state the blocker and leave the branch and
working tree ready for the user.

## Final Approval Criteria

The reviewed work is not approvable if any of these remain:

- Constitution violations.
- Missing or incomplete tasks from `tasks.md`.
- Spec deviations.
- Type-safety violations.
- Incorrect architecture or layering.
- Broken monorepo boundaries.
- Missing migrations or database inconsistencies.
- Mockup deviations.

Success means the code fully matches the constitution, `.agent/rules/*.md`, the
selected spec folder, and any approved mockups, with no missing functionality or
architectural violations.
