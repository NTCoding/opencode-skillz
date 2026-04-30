---
description: Resolve approved GitHub pull request feedback with local evidence, validation, replies, and thread resolution
---

Resolve GitHub pull request feedback for:
$ARGUMENTS

## Required PR input

1. Extract both values from `$ARGUMENTS`:
   - pull request number
   - full pull request URL
2. If either value is missing, stop and ask for the missing value.
3. Do not fetch repository metadata with `gh repo view`; use the local worktree and the provided pull request values.

## Feedback discovery

1. Call the `nt_skillz_pr_feedback` tool with exactly these arguments:

```json
{
  "pullRequestNumber": "<pull request number>",
  "pullRequestUrl": "<full pull request URL>"
}
```

2. Use the tool output as the feedback source of truth.
3. Do not replace the tool with ad hoc `gh pr view`, `gh pr diff`, `gh api`, or local-only review discovery commands.

## Approval plan format

Before editing files, present every unresolved thread from the tool output using exactly this format:

```md
## Thread <thread_id>

### Reviewer feedback
<copy the full Reviewer feedback section from the tool output>

### Review context
<copy the full Review context section from the tool output>

### Current local code
<copy the full Current local code section from the tool output>

### Problem analysis
- Problem: <specific defect, missing test, design issue, or documentation mismatch visible in the feedback, diff hunk, and local code>
- Evidence: <specific evidence from the reviewer comment, diff hunk, and current local code>
- Scope: <exact files and behavior affected>

### Proposed change
- Edit `<path>`: <exact code, test, or documentation behavior change>
- Leave unchanged: <exact files or behavior that will not be touched>

### Validation
- During edits: call `nt_skillz_lint` after each small TypeScript change with the changed `.ts` or `.tsx` file paths only.
- Before commit: run `git diff --name-only --diff-filter=ACMR HEAD -- '*.ts' '*.tsx'`, then call `nt_skillz_lint` with every returned file path.
- Before commit coverage: run `git diff --name-only --diff-filter=ACMR HEAD -- '*.ts' '*.tsx'`, then run `/nt-skillz:vitest-coverage <file>` for each returned path and require 100% coverage unless the run prints `SKIP:`.
- Additional command: `<exact project command required to verify this feedback, or "none">`

### GitHub reply to post after validation passes
`[Resolve] <exact response>`

### Resolution action
Resolve thread after successful reply: yes
```

## Approval stop

1. Stop after presenting the approval plan.
2. Ask which thread fixes are approved.
3. Do not edit files until the user approves specific thread IDs.
4. If the user approves only some threads, edit only the approved thread fixes.
5. If a thread cannot be mapped to a concrete file and behavior change, ask for clarification instead of editing.

## Implementation standards

1. Implement approved fixes only.
2. Do not make unrelated refactors, formatting changes, dependency changes, or drive-by cleanups.
3. After each small TypeScript code change, call `nt_skillz_lint` with only the `files` argument for the changed `.ts` or `.tsx` file or files from that step.
4. Do not pass `base` or `head` to `nt_skillz_lint` during normal implementation work.
5. Fix all lint errors on new code before continuing.
6. If lint fails on existing code, ignore only errors that are unrelated and not near the changed code.
7. Line-length limits do not count as existing code; fix line-length errors caused by new code.

## Required validation before any commit

Before committing feedback fixes:

1. Run `git diff --name-only --diff-filter=ACMR HEAD -- '*.ts' '*.tsx'`.
2. Call `nt_skillz_lint` with `files` set to every path returned by step 1.
3. Run `/nt-skillz:vitest-coverage <file>` for each path returned by step 1.
4. Ignore only coverage runs that print a `SKIP:` line.
5. Do not commit unless every remaining file has 100% Vitest coverage or the user explicitly confirms that 100% coverage is impossible for the relevant component.
6. Run each approved thread's `Additional command` when the value is not `none`.
7. Do not commit if any required validation fails.

## Commit rule

1. Do not commit unless the user explicitly requests a commit.
2. If the user requests a commit, run the required validation before the commit.
3. Commit only files changed for approved thread fixes.

## GitHub reply and thread resolution

After validation passes for an approved thread:

1. Reply to the thread with this exact GraphQL mutation:

```bash
gh api graphql \
  -f threadId='<thread_id>' \
  -f body='[Resolve] <approved response body>' \
  -f query='mutation($threadId: ID!, $body: String!) { addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) { comment { url } } }'
```

2. Resolve the thread with this exact GraphQL mutation:

```bash
gh api graphql \
  -f threadId='<thread_id>' \
  -f query='mutation($threadId: ID!) { resolveReviewThread(input: { threadId: $threadId }) { thread { id isResolved } } }'
```

3. Do not resolve a thread before the reply mutation succeeds.
4. Do not resolve a thread when validation failed.
5. Do not resolve a thread that was not approved by the user.

## Final report

Report only:

- approved thread IDs fixed
- unapproved thread IDs left untouched
- validation commands run and pass/fail status
- GitHub reply URLs returned by the reply mutation
- resolved thread IDs returned by the resolution mutation
- blockers that require user action
