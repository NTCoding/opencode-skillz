---
description: Run Vitest coverage for a pull request and update the PR description coverage block
---

Review pull request coverage for:
$ARGUMENTS

## Software Design Compliance

Ensure all new and modified code complies with `/nt-skillz:software-design`

Leave in-line feedback on the PR for lines that do not comply. Prefix messages with [Software Design]

## Test Quality 

Ensure all new and modified tests comply with  `/nt-skillz-writing-tests`

Leave in-line feedback on the PR for lines that do not comply. Prefix messages with [Test Quality]

## Test Coverage Analysis 

Add a test coverage analysis results section to the PR description:

1. Resolve the pull request from `$ARGUMENTS`.
2. If `$ARGUMENTS` does not identify a PR URL or PR number, stop and ask for one.
3. Run `gh pr diff <pr> --name-only`.
4. For each changed path from that output, run `/nt-skillz:vitest-coverage <file>`.
5. Ignore only runs that print a `SKIP:` line.
6. If every run prints a `SKIP:` line, use one fenced `text` block containing `No changed TypeScript source files.` as the coverage content.
7. Otherwise, build the PR coverage block in this exact shape:
    - `<!-- nt-skillz-coverage:start -->`
    - `## Coverage`
    - one `### \`<file>\`` heading for each non-`SKIP:` file
    - one fenced `text` block containing the exact raw `/nt-skillz:vitest-coverage <file>` output directly under that file heading
    - `<!-- nt-skillz-coverage:end -->`
8. Run `gh pr view <pr> --json body --jq '.body'` and use the returned text as the current PR body.
9. If the current PR body already contains both marker lines, replace only the text from `<!-- nt-skillz-coverage:start -->` through `<!-- nt-skillz-coverage:end -->` with the new coverage block.
10. If the current PR body does not contain both marker lines, append the new coverage block to the end of the PR body separated by two newlines.
11. Write the updated PR body to a temporary file.
12. Run `gh pr edit <pr> --body-file <temporary-file>`.
13. Do not summarize, interpret, or paraphrase the coverage output.
14. Do not modify any other part of the PR body.
