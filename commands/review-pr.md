---
description: Review PR code quality, test quality, and coverage
---

Review pull request code quality, test quality, and coverage for:
$ARGUMENTS

## PR Resolution

1. Resolve the pull request from `$ARGUMENTS`.
2. If `$ARGUMENTS` does not identify a PR URL or PR number, stop and ask for one.
3. Run `gh pr diff <pr> --name-only` to identify changed files.
4. Fetch existing PR review comments and do not post the same comment twice on the same line.

## Parallel Review Subtasks

The `Software Design Compliance` and `Test Quality` reviews should run in parallel.

### Software Design Compliance

Invoke the default subagent with a task prompt that requires it to:

1. Review new and modified production code against `/nt-skillz:software-design`.
2. Leave inline feedback only on changed PR diff lines.
3. Prefix every inline message with `[Software Design]`.
4. If a finding cannot be attached to a changed diff line, return it as a summary finding instead of posting an inline comment.
5. Return the count of inline findings and summary findings.

Provide the subagent with:

- the resolved PR identifier
- the changed file list
- the changed diff context


### Test Quality

Invoke the default subagent with a task prompt that requires it to:

1. Review new and modified tests against `/nt-skillz:writing-tests`.
2. Leave inline feedback only on changed PR diff lines.
3. Prefix every inline message with `[Test Quality]`.
4. If a finding cannot be attached to a changed diff line, return it as a summary finding instead of posting an inline comment.
5. Return the count of inline findings and summary findings.

Provide the subagent with:

- the resolved PR identifier
- the changed file list
- the changed diff context

## Tool-Generated PR Description Sections

Add generated lint and coverage sections to the PR description:

1. Invoke the `nt_skillz_lint` tool with `mode: "pr-review"` and the resolved PR identifier.
2. Invoke the `nt_skillz_vitest_coverage` tool with `mode: "pr-review"` and the resolved PR identifier.
3. Use the exact markdown returned by each tool. Do not summarize, interpret, paraphrase, or reformat tool output.
4. Run `gh pr view <pr> --json body --jq '.body'` and use the returned text as the current PR body.
5. If the current PR body already contains both marker lines for a generated section, replace only the text from the start marker through the end marker with the new tool output for that section.
6. If the current PR body does not contain both marker lines for a generated section, append the new tool output to the end of the PR body separated by two newlines.
7. Write the updated PR body to a temporary file.
8. Run `gh pr edit <pr> --body-file <temporary-file>`.
9. Do not modify any other part of the PR body.

## Basic PR checks

Look for the following issues on the PR:

1. Unnecessary noise: does the PR contains noise in the dif like unnecessary formatting changes? Those should be removed to make the reviewer's job easier unless they are enforced by the project conventions.

2. Out of scope changes: does the PR contain modification to files that are not strictly necessary that add more unnecessary noise to the diff? Like refactoring existing code.

## Final Report

Report only:

- software design inline findings count
- software design summary findings count
- test quality inline findings count
- test quality summary findings count
- coverage block update status
- blockers that require user action
