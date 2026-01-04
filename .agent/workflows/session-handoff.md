---
description:
  End-of-session workflow to update project memory and preserve context for next
  conversation
---

# Session Handoff Workflow

Use this workflow at the end of a conversation to preserve context for the next
session.

## When to Run

- At the end of a productive work session
- When the user says "end session", "session handoff", "wrap up", or similar
- Before switching to a different major task area
- When significant decisions or progress has been made

## Steps

### 1. Summarize the Session

Create a brief summary of what was accomplished:

- Main topic/focus of the session
- Key tasks completed
- Important decisions made
- Any new business logic established
- Files created or significantly modified

### 2. Update Project Memory

// turbo Read and update `docs/agent/project-memory.md`:

```bash
# View current status
cat docs/agent/project-memory.md
```

Update the following sections as needed:

#### Section 5: Current Project Status

- Move completed items from "In Progress" to "Completed"
- Add new pending items discovered during the session
- Update "In Progress" with current work

#### Section 7: Recent Sessions

- Add the current session to the top
- Keep only the last 10 sessions
- Remove oldest entries if needed

### 3. Update Session History

// turbo Append the session details to `docs/agent/session-history.md`:

```markdown
---

## Session: [DATE]

**Duration:** [approximate time] **Main Topic:** [primary focus]

### Accomplished

- [list of completed items]

### Decisions Made

- [any new business logic or design decisions]

### Files Changed

- [list of significant files created/modified]

### Pending / Next Steps

- [items left for next session]

### Context Notes

[Any important context for the next agent to know]
```

### 4. Check for Business Logic Updates

If any new business decisions were made:

// turbo

- Update `docs/business/business-decisions.md` with the new decisions
- Reference the section number in the session history

### 5. Notify User

Provide a brief handoff summary to the user:

```
✅ Session handoff complete!

**What was accomplished:**
- [brief list]

**Memory updated:**
- project-memory.md ✓
- session-history.md ✓

**Next session should:**
- [recommended next steps]
```

## Template for Session History Entry

Copy and fill in:

```markdown
---

## Session: YYYY-MM-DD

**Duration:** X hours **Main Topic:** [Topic Name]

### Accomplished

- [ ] Item 1
- [ ] Item 2

### Decisions Made

- Decision 1: [description]

### Files Changed

| File           | Change                               |
| -------------- | ------------------------------------ |
| `path/to/file` | Created/Modified - brief description |

### Pending / Next Steps

1. Next task
2. Another pending item

### Context Notes

Important context for continuity...
```

## Notes

- Always preserve the `alwaysApply: true` frontmatter in project-memory.md
- Keep session history entries concise but informative
- Focus on information that helps the next agent pick up where you left off
- Don't duplicate full file contents; reference paths instead
