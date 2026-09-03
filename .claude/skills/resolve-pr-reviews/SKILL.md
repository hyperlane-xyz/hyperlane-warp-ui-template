---
name: resolve-pr-reviews
description: Review and resolve PR review comments interactively. Fetches unresolved comments, proposes fixes or explains why to skip, and replies on GitHub.
---

# Resolve PR Reviews

Use this skill to process review comments on a PR. Pass the PR number as an argument (e.g. `/resolve-pr-reviews 1041`).

## Workflow

### Step 1: Fetch unresolved review comments

Use the GitHub API to get all review comments that haven't been resolved:

```bash
# Get inline review comments (pull request review comments)
gh api repos/{owner}/{repo}/pulls/{pr}/comments --jq '.[] | select(.position != null or .line != null)'

# Get issue-level comments (general PR comments from reviewers, not bots)
gh api repos/{owner}/{repo}/issues/{pr}/comments
```

Filter out:
- Deployment/CI bots (Vercel deploy previews, CI status checks)
- Already-resolved threads
- Your own previous replies

Keep:
- AI review comments (Claude review bot, CodeRabbit inline suggestions) — these are actionable review feedback
- Human reviewer comments

### Step 2: Analyze each comment

For each unresolved comment:
1. Read the relevant code being commented on
2. Understand the reviewer's concern
3. Propose a concrete fix OR explain why it should be skipped
4. Categorize severity: **must fix**, **good idea**, or **skip** (with reasoning)

### Step 3: Present to user

**IMPORTANT: You MUST ask the user this question BEFORE showing any analysis. Do NOT skip this step or present comments prematurely.**

After fetching and analyzing comments internally, use the `AskUserQuestion` tool to present a selection prompt:

```
Question: "Found N review comments on PR #XXXX. How would you like to go through them?"
Options:
  - "One by one" — Present each comment individually, user decides fix/skip before next
  - "All at once" — Present all comments together, user reviews full list
```

Wait for the user's selection before proceeding. Then:

- **"one by one"** (default): Present each comment individually with your analysis and proposed solution. Wait for user to decide "fix" or "skip" before moving to the next one.
- **"all at once"**: Present all comments together with your analysis. User reviews the full list, then says which to fix and which to skip.

For each comment, show:
- The reviewer's comment (abbreviated)
- **Your own independent analysis** — don't just parrot the reviewer. Verify if the concern is actually valid, check the relevant code/dependencies, and explain what's really happening. If the reviewer is wrong or partially wrong, say so.
- Your proposed fix (code diff) or skip reasoning
- Your recommendation

### Step 4: Apply fixes

Apply all approved fixes to the codebase.

### Step 5: Commit and push

Run the `/commit` skill to format, lint, typecheck, stage, and commit. Then push:

```bash
git push
```

### Step 6: Reply to comments on GitHub

Reply to each comment using the correct GitHub API endpoints:

**For inline review comments** (pull request review comments):
```bash
# Reply to an inline review comment (creates a reply in the same thread)
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
  --method POST \
  -f body="<reply text>"
```

**For issue-level comments** (general PR comments):
```bash
gh api repos/{owner}/{repo}/issues/{pr}/comments \
  --method POST \
  -f body="<reply text>"
```

Reply content:
- If fixed: "Fixed in <commit_sha>." (keep it short)
- If skipped: Brief explanation of why (1-2 sentences)
- Tag the reviewer with `@username` when replying to top-level comments

## Important Notes

- **Never guess comment IDs** — always fetch them from the API first
- **Test the reply endpoint** — `pulls/{pr}/comments/{id}/replies` is for inline review comment threads. `issues/{pr}/comments` is for general PR comments.
- **Don't reply to deploy/CI bots** — skip Vercel deploy previews, CI status comments. DO reply to AI review bots (Claude, CodeRabbit inline suggestions).
- **Keep replies concise** — reviewers don't want essays
