---
name: claude-review
description: Review code changes using Hyperlane Warp UI coding standards. Use when reviewing PRs, checking your own changes, or doing self-review before committing.
---

# Code Review Skill

Use this skill to review code changes against Hyperlane Warp UI standards.

## When to Use

- Before committing changes (self-review)
- When asked to review a PR or diff
- To check if changes follow project patterns

## Instructions

Read and apply the guidelines from `REVIEW.md` to review the code changes.

### For PR Reviews

When reviewing a PR, deliver feedback as a **single consolidated GitHub review** using `/inline-pr-comments`. Each run produces a separate review — nothing is overwritten.

1. **Fetch prior reviews first** — the `/inline-pr-comments` skill fetches existing reviews/comments so you can avoid duplicating feedback and stay aware of ongoing discussions
2. **Review body** — Overall assessment, architecture concerns, and issues found outside the diff
3. **Inline comments** — Specific issues on changed lines (attached to the same review)

### For Self-Review

When reviewing your own changes before committing:

1. Run `git diff` to see changes
2. Apply the code review guidelines
3. Fix issues directly rather than commenting
