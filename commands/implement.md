---
description: Implement the requested changes or specified document with small-step lint verification
---

Implement:
$ARGUMENTS


Implement the required task to the highest standards possible. Do not take shortcuts, do not rush, do not jump to the easiest solution to make the code pass. Think carefully, explore options and write the code that is easiest to read, easiest change, and will not break in production.

## Linting

After each small TypeScript code change, call `nt_skillz_lint` with only the `files` argument for the changed `.ts` or `.tsx` file or files from that step.

- do not pass `base` or `head` during normal implementation work
- all lint errors on new code must be addressed before continuing
- if the lint fails on existing code, ignore the error unless it is very close to the new code
- line-length limits do not count as existing code; if new code causes a file-length lint error, it must be fixed

## Test Coverage

Before each commit:

1. Run `git diff --name-only --cached --diff-filter=ACMR -- '*.ts' '*.tsx'`.
2. For each returned path, run `/nt-skillz:vitest-coverage <file>`.
3. Ignore only runs that print a `SKIP:` line.
4. Do not create the commit unless every remaining file has 100% Vitest coverage (or it's impossible to achieve 100% test coverage for the relevant component)