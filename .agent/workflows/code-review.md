---
description: Perform a comprehensive code review on a branch/PR, add comments
---

# Code Review & Fix Workflow

This workflow guides the agent to perform an expert-level code review on the
user's active branch or Pull Request, provide specific feedback, and then
automatically create a new PR containing the proposed fixes targeting the user's
original work.

---

## 1. Context Gathering

Before looking at any code, the agent MUST load and internalize the following
context:

### 🔹 Project Constitution

- Read `e:\Work\My Projects\Astik\.specify\memory\constitution.md`
- Treat it as the **highest authority**
- All principles are **non-negotiable and must be enforced strictly**

### 🔹 Project Rules

- Read all files under: `e:\Work\My Projects\Astik\.agent\rules\`
- Treat these rule files as the **source of truth for implementation standards**

### 🔹 Specs (CRITICAL)

- Identify the current branch name
- Locate the matching folder under `specs/`
  - The folder name MUST **exactly match the branch name**

  **Example:**
  - Branch: `017-dashboard-ui-polish`
  - Folder: `specs/017-dashboard-ui-polish`

- Read all relevant Markdown files inside that folder:
  - `spc.md`
  - `plan.md`
  - `tasks.md`

- Treat these files as the **source of truth for feature requirements**

---

## 2. Code Analysis

- Identify the target branch or Pull Request to be reviewed
- Extract all changed files (PR diff)

### 🔍 2.1 Constitution Compliance (MANDATORY)

For every change in the PR:

- Identify which principles from `constitution.md` apply
- Validate strict compliance

#### Required Checks:

1. **Architecture & Data Flow**
   - Offline-first enforced (WatermelonDB first, network second)
   - No API-dependent core calculations
   - Required sync fields exist

2. **Business Logic**
   - Matches `docs/business/business-decisions.md`
   - No assumptions or undocumented logic

3. **Type Safety (NON-NEGOTIABLE)**
   - No `any`
   - Explicit return types
   - Safe null handling (no `!`)
   - `zod` validation for external data

4. **Layer Separation**
   - No business logic in components or hooks
   - Services handle DB writes
   - `packages/logic` contains shared logic only

5. **UI & Styling**
   - NativeWind (Tailwind) used correctly
   - No hardcoded colors
   - No `isDark` misuse
   - UI strictly matches schema

6. **Monorepo Boundaries**
   - No invalid imports
   - Dependency direction respected

7. **Database & Migrations**
   - All schema changes via SQL migrations
   - No direct DB modifications outside migrations
   - Generated files committed

8. **Code Quality**
   - No magic numbers
   - No missing TODOs for tech debt
   - Proper naming conventions
   - No `console.log`

---

### 📂 2.2 Specs Compliance (MANDATORY)

- Review changed files under the `specs/` folder
- Ensure the correct folder is used (matches branch name)

For all code changes:

- Verify full alignment with:
  - `spc.md` (specification)
  - `plan.md` (implementation approach)
  - `tasks.md` (execution checklist)

#### Check for:

- Missing functionality
- Incomplete tasks
- Deviations from plan or spec

🚨 **Blocking Rule:**

- If any task in `tasks.md` is not implemented or justified → PR is **NOT
  APPROVABLE**

---

### 📏 2.3 Rules Compliance (MANDATORY)

For every changed file:

- Identify relevant rules from `.agent/rules/*.md`
- Validate that implementation follows them

#### Check for:

- Violations of defined rules
- Missing required patterns
- Incorrect implementations
- Inconsistencies across the codebase
- Code bypassing rules

---

### 🧠 2.4 General Best Practices

Strictly enforce:

- **React Native & Expo best practices**
- **TypeScript strict mode**
- **SOLID principles**
- **Clean code & DRY**

---

## 2.5. Review Existing Bot/Automated Comments

If the PR has existing review comments from automated tools (e.g.,
**CodeRabbit**, **SonarCloud**, **ESLint bot**), the agent MUST:

- Fetch all PR comments
- Filter bot comments (e.g., `coderabbitai[bot]`)

For each finding:

- **Accept** → include in fix plan
- **Defer** → add `// TODO:` with explanation
- **Reject** → document reason in PR description

Avoid duplicate fixes.

---

## 3. Submit Review Feedback

- Provide **clear, structured, actionable feedback**

### 📌 Format for Violations

#### Constitution Violations

- ❌ Violation: <title>
  - 📄 Principle: <constitution principle>
  - 📍 Location: <file + line>
  - 🧨 Issue: explanation
  - ✅ Fix: concrete solution

#### Rules Violations

- ❌ Violation: <title>
  - 📄 Rule: `.agent/rules/<file>.md`
  - 📍 Location: <file + line>
  - 🧨 Issue: explanation
  - ✅ Fix: suggestion

#### Specs Violations

- ❌ Violation: <title>
  - 📄 Spec: `spc.md / plan.md / tasks.md`
  - 📍 Location: <file + line>
  - 🧨 Issue: missing or incorrect implementation
  - ✅ Fix: required implementation

#### Improvements

- ⚠️ Improvement:
  - 📄 Reference: (rule or principle if applicable)
  - 💡 Suggestion

---

## 4. Implement Fixes

- Create a new branch from the user's branch:
  - `agent-fixes/<original-branch-name>`

- Apply fixes for:
  - Constitution violations
  - Specs gaps
  - Rules violations
  - Accepted bot findings

- Ensure final code:
  - Fully complies with constitution
  - Fully implements specs
  - Follows all rules

- Commit with clear messages

---

## 5. Create Fix Pull Request

- Push branch to remote

- Create PR with:
  - **Base branch = user's original branch**

- Include:
  - Checklist of fixes
  - Summary of violations resolved
  - Notes on deferred/rejected bot comments

---

## 🚨 Final Approval Criteria

The PR is **NOT APPROVABLE** if any of the following exist:

- Constitution violations
- Missing or incomplete tasks from `tasks.md`
- Spec deviations
- Type safety violations
- Incorrect architecture or layering
- Broken monorepo boundaries
- Missing migrations or DB inconsistencies

---

## ✅ Success Criteria

- Code fully matches:
  - `constitution.md`
  - `.agent/rules/*.md`
  - `specs/<branch-name>/*`

- No missing features
- No architectural violations
- Clean, maintainable, production-ready code
