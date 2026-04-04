---
description:
  Extract reusable patterns from the current session and save them as skills.
---

# /learn - Extract Reusable Patterns

Analyze the current session and extract any patterns worth saving as skills.

## Trigger

Run `/learn` at any point during a session when you've solved a non-trivial
problem.

## What to Extract

Look for:

1. **Error Resolution Patterns** — What error occurred? Root cause? What fixed
   it? Is this reusable?
2. **Debugging Techniques** — Non-obvious debugging steps, tool combinations
   that worked
3. **Workarounds** — Library quirks, API limitations, version-specific fixes
4. **Project-Specific Patterns** — Codebase conventions discovered, architecture
   decisions made

## Output Format

Create a skill file at `.claude/rules/[pattern-name].md`:

```markdown
# [Descriptive Pattern Name]

**Extracted:** [Date] **Context:** [Brief description of when this applies]

## Problem

[What problem this solves - be specific]

## Solution

[The pattern/technique/workaround]

## Example

[Code example if applicable]

## When to Use

[Trigger conditions - what should activate this skill]
```

## Process

1. Review the session for extractable patterns
2. Identify the most valuable/reusable insight
3. Draft the skill file
4. Ask user to confirm before saving
5. Save to `.claude/rules/`

## Notes

- Don't extract trivial fixes (typos, simple syntax errors)
- Don't extract one-time issues (specific API outages, etc.)
- Focus on patterns that will save time in future sessions
- Keep skills focused - one pattern per skill
