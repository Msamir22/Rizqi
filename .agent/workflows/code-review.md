---
description:
  Perform a comprehensive code review on a branch/PR, add comments, and open a
  fix PR targeting the original branch.
---

# Code Review & Fix Workflow

This workflow guides the agent to perform an expert-level code review on the
user's active branch or Pull Request, provide specific feedback, and then
automatically create a new PR containing the proposed fixes targeting the user's
original work.

## 1. Context Gathering

Before looking at any code, the agent MUST load and internalize the following
context:

- **Project Constitution**: Read
  `e:\Work\My Projects\Astik\.specify\memory\constitution.md` to align with the
  core architectural and product principles.
- **Project Rules**: Read the available rule files in
  `e:\Work\My Projects\Astik\.agent\rules\` to understand specific technical
  guidelines.
- **Best Practices** to strictly enforce:
  - **React Native & Expo**: Proper component structures, efficient rendering,
    safe area handling, and native best practices.
  - **TypeScript**: Strict definitions, no `any`, proper interface usage, and
    absolute type safety.
  - **Architecture**: Strictly adhere to **SOLID principles**.
  - **Code Quality**: Ensure the code is **clean** and follows the **DRY (Don't
    Repeat Yourself)** principle to eliminate duplication.

## 2. Code Analysis

- Identify the target branch or Pull Request to be reviewed.
- Extract the code changes (e.g., using GitHub MCP server to get PR files, or
  local git diff).
- Systematically review the modified code against the rules and best practices
  internalized in Step 1.
- Identify bugs, anti-patterns, missing types, duplicate logic, and
  architectural flaws.

## 3. Submit Review Feedback

- Write constructive, specific, and actionable review comments.
- **For GitHub PRs:** Use tools like `mcp_github_create_pull_request_review` or
  `mcp_github_add_issue_comment` to add line-by-line comments and an overall
  summary directly to the PR.
- **For Local Branches:** Generate a Markdown artifact (`code-review-report.md`)
  detailing the file-by-file feedback.

## 4. Implement Fixes

- Create and check out a new branch branching off from the _user's original
  branch_ being reviewed.
  - _Naming convention:_ `agent-fixes/<original-branch-name>`
- Apply fixes addressing each of the review comments and feedback points
  identified in Step 3.
- Refactor the code as needed, ensuring it perfectly aligns with the project
  constitution and rules.
- Commit the changes locally with clear, descriptive commit messages.

## 5. Create Fix Pull Request

- Push the newly created branch to the remote repository.
- Use the `mcp_github_create_pull_request` tool to open a new Pull Request.
- **CRITICAL PR CONFIGURATION:** Set the **Base Branch** of this new PR to be
  the **user's original branch** (the one that was just reviewed), NOT `main`.
  This allows the user to easily review the agent's proposed fixes against their
  own work.
- Add a detailed PR body containing a checklist of the review comments that were
  addressed.
- Notify the user with a link or reference to the new PR so they can inspect and
  merge the changes.
