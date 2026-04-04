---
description:
  End-of-session workflow to create detailed session file and update memory
---

# Session Handoff Workflow

Use this workflow at the end of a conversation to preserve detailed context for
future sessions.

## When to Run

- At the end of a productive work session
- When the user says "end session", "session handoff", "wrap up", or similar
- Before switching to a different major task area
- When significant decisions or progress has been made

---

## Steps

### 1. Gather Session Information

Collect the following details about the current session:

- **Date & Time:** Current date and approximate start time
- **Duration:** Approximate session length
- **Main Topic:** Primary focus of the session (2-5 words)
- **Summary:** Brief paragraph describing what was accomplished
- **Files Changed:** List of created/modified files with descriptions
- **Decisions Made:** Key decisions, especially business logic
- **Business Logic:** If any new business rules were established, document them
  in detail
- **Pending Items:** What's left to do
- **Context Notes:** Important context for the next agent

### 2. Create Detailed Session File

// turbo Create a new file in `docs/agent/sessions/` with naming convention:
`YYYY-MM-DD_HHMM_topic-slug.md`

Example: `2026-01-04_2235_memory-system-enhancement.md`

Use this template:

```markdown
# Session: [Topic Title]

**Date:** YYYY-MM-DD **Time:** HH:MM - HH:MM **Duration:** ~X minutes/hours

---

## Summary

[1-2 paragraph description of what was accomplished]

---

## What Was Accomplished

### Files Created

| File           | Purpose     |
| -------------- | ----------- |
| `path/to/file` | Description |

### Files Modified

| File           | Changes                |
| -------------- | ---------------------- |
| `path/to/file` | Description of changes |

### Key Decisions Made

1. **Decision Name:** Description and rationale
2. **Decision Name:** Description and rationale

---

## Business Logic Changes

> If no business logic was changed, write: "No business logic changes in this
> session."

### [Topic of Business Logic]

[Detailed description of business rule, including:]

- What the rule is
- Why it was decided
- How it affects the system
- Reference to business-decisions.md section if applicable

---

## Technical Details

[Any technical implementation details, architecture decisions, or code patterns
worth noting]

---

## Pending Items

- [ ] Item 1
- [ ] Item 2

---

## Context for Next Session

[Important context that helps the next agent continue seamlessly]
```

### 3. Update Session Index

// turbo Add a new row to the table in `docs/agent/session-history.md`:

```markdown
| YYYY-MM-DD | HH:MM | Topic | [filename.md](file:///path/to/file.md) |
```

### 4. Update Project Memory

// turbo Update `docs/agent/project-memory.md`:

#### Section 5: Current Project Status

- Move completed items from "In Progress" to "Completed"
- Add new pending items discovered during the session

#### Section 7: Recent Sessions

- Add brief summary of current session to the top
- Keep only the last 10 session summaries
- Remove oldest entry if needed

Format for Section 7 entry:

```markdown
### Session: YYYY-MM-DD (HH:MM)

- **Topic:** [Topic Name]
- **Accomplished:** [Brief 1-2 sentence summary]
- **Outcome:** [Key outcome or decision]
```

### 5. Update Business Decisions (If Applicable)

// turbo If any new business logic was established:

- Update `docs/business/business-decisions.md` with the new rules
- Add the section number to the session file's "Business Logic Changes" section

### 6. Notify User

Provide a handoff summary:

```text
✅ Session handoff complete!

**Session File Created:**
- docs/agent/sessions/YYYY-MM-DD_HHMM_topic.md

**What was accomplished:**
- [brief list]

**Memory Updated:**
- project-memory.md ✓
- session-history.md ✓

**Next session should:**
- [recommended next steps]
```

---

## Quick Reference

### File Locations

| File                                  | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `docs/agent/project-memory.md`        | Main memory with summaries (always loaded) |
| `docs/agent/session-history.md`       | Index linking to session files             |
| `docs/agent/sessions/*.md`            | Detailed individual session files          |
| `docs/business/business-decisions.md` | Finalized business logic                   |

### Naming Convention

Session files: `YYYY-MM-DD_HHMM_topic-slug.md`

- Use lowercase with hyphens for topic slug
- Keep topic slug to 3-5 words max
- Examples:
  - `2026-01-04_2235_memory-system-enhancement.md`
  - `2026-01-05_1430_category-picker-ui.md`

---

## Notes

- Always preserve the `alwaysApply: true` frontmatter in project-memory.md
- Be thorough with business logic documentation - future agents will rely on it
- Keep project-memory.md summaries brief; details go in session files
- Link to session files from the index, not embed their content
