---
name: inline-pr-comments
description: Post a single consolidated PR review with summary and inline comments. Use this skill to deliver code review feedback as one unified review per run.
---

# Consolidated PR Review Skill

Use this skill to submit code review feedback as a **single consolidated GitHub review** containing both the summary body and all inline comments.

## When to Use

- After completing a code review (use with /claude-review)
- When you have specific line-by-line feedback to deliver

## Instructions

Submit one consolidated review per run using the GitHub API. **Do NOT post inline comments individually.** Each run produces a new review — nothing is overwritten.

### Step 1: Fetch Prior Review Context

Before reviewing, read existing reviews and comments on the PR for context:

```bash
# Fetch existing reviews (summaries)
gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/reviews" --jq '.[] | {user: .user.login, state: .state, body: .body}'

# Fetch inline review comments
gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/comments" --jq '.[] | {user: .user.login, path: .path, line: .line, body: .body}'

# Fetch general PR discussion comments
gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" --jq '.[] | {user: .user.login, body: .body}'
```

Use this context to:

- **Skip issues already raised** — don't re-flag something a prior review already pointed out
- **Reference prior discussions** — e.g. "As noted in the previous review, ..."
- **Flag unresolved issues** — if a prior review raised something that still isn't fixed, note it briefly (e.g. "Still unresolved from prior review: ...")
- **Avoid contradictions** — don't suggest the opposite of what a human reviewer requested

### Step 2: Collect All Findings

Complete the full review. Collect:

- **Summary** — Overall assessment, architecture concerns, non-diff observations
- **Inline comments** — Specific issues on changed lines (path, line, body)

### Step 3: Build Review JSON

Write a JSON file to `/tmp/review.json`:

```json
{
  "body": "## Review Summary\n\nOverall assessment here.\n\n## Observations Outside This PR\n- `file:line`: description",
  "event": "COMMENT",
  "comments": [
    {
      "path": "src/file.ts",
      "line": 42,
      "body": "Issue description here"
    },
    {
      "path": "src/other.ts",
      "start_line": 10,
      "line": 15,
      "body": "Multi-line comment"
    }
  ]
}
```

**Fields:**

- `body` — Markdown review summary (required)
- `event` — Always `"COMMENT"` (never APPROVE or REQUEST_CHANGES)
- `comments` — Array of inline comment objects (can be empty if no inline findings)
  - `path` — File path relative to repo root
  - `line` — Line number in the NEW version of the file
  - `start_line` + `line` — For multi-line comments
  - `body` — Markdown-formatted feedback

### Step 4: Submit the Review

```bash
gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/reviews" --input /tmp/review.json
```

The `GITHUB_REPOSITORY` and `PR_NUMBER` environment variables are set by the CI workflow.

### Limitations

- Inline comments can only target lines in the diff (changed/added lines)
- Comments targeting unchanged lines will cause the API call to fail
- If unsure whether a line is in the diff, put the finding in the summary body instead

### Handling Non-Diff Findings

Issues in code NOT changed by the PR go in the review `body` under a dedicated section:

```markdown
## Observations Outside This PR

- `src/utils/foo.ts:142`: Pre-existing null check missing
- `src/core/bar.ts:78-82`: Similar pattern to line 45 issue
```

### Feedback Guidelines

| Feedback Type                 | In Diff? | Where to Put It                                      |
| ----------------------------- | -------- | ---------------------------------------------------- |
| Specific code issue           | Yes      | `comments` array entry for that line                 |
| Pattern repeated across files | Yes      | First occurrence in `comments` + note others in body |
| Related issue found           | No       | `body` under "Observations Outside This PR"          |
| Pre-existing bug discovered   | No       | `body` (consider separate issue if critical)         |
| Overall architecture concern  | N/A      | `body`                                               |

Be concise. Group minor style issues together. Never use APPROVE or REQUEST_CHANGES.
