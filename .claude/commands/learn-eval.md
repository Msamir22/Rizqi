---
description:
  "Extract reusable patterns from the session, self-evaluate quality before
  saving, and determine the right save location."
---

# /learn-eval - Extract, Evaluate, then Save

Extends `/learn` with a quality gate and save-location decision before writing
any skill file.

## What to Extract

Look for:

1. **Error Resolution Patterns** — root cause + fix + reusability
2. **Debugging Techniques** — non-obvious steps, tool combinations
3. **Workarounds** — library quirks, API limitations, version-specific fixes
4. **Project-Specific Patterns** — conventions, architecture decisions,
   integration patterns

## Process

1. Review the session for extractable patterns
2. Identify the most valuable/reusable insight
3. **Determine save location:**
   - Ask: "Would this pattern be useful in a different project?"
   - **Project** (`.claude/rules/`): Project-specific knowledge
   - When in doubt, save to project-level
4. Draft the skill file
5. **Quality gate — Checklist + Holistic verdict**

### 5a. Required Checklist

- [ ] Check existing skills for content overlap
- [ ] Check project memory/docs for overlap
- [ ] Consider whether appending to an existing skill would suffice
- [ ] Confirm this is a reusable pattern, not a one-off fix

### 5b. Holistic Verdict

| Verdict               | Meaning                                 | Next Action                              |
| --------------------- | --------------------------------------- | ---------------------------------------- |
| **Save**              | Unique, specific, well-scoped           | Proceed to save                          |
| **Improve then Save** | Valuable but needs refinement           | List improvements → revise → re-evaluate |
| **Absorb into [X]**   | Should be appended to an existing skill | Show target skill and additions          |
| **Drop**              | Trivial, redundant, or too abstract     | Explain reasoning and stop               |

6. **Verdict-specific confirmation flow**
   - **Save**: Present save path + checklist results + draft → save after user
     confirmation
   - **Improve then Save**: Present improvements + revised draft → re-evaluate
   - **Absorb into [X]**: Present target path + additions (diff format) → append
     after user confirmation
   - **Drop**: Show reasoning only (no confirmation needed)

7. Save / Absorb to the determined location

## Notes

- Don't extract trivial fixes (typos, simple syntax errors)
- Don't extract one-time issues (specific API outages, etc.)
- Focus on patterns that will save time in future sessions
- Keep skills focused — one pattern per skill
- When the verdict is Absorb, append to the existing skill rather than creating
  a new file
