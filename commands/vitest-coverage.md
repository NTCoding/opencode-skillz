---
description: Reusable Vitest coverage workflow for TypeScript source files
---

Run Vitest coverage for:
$ARGUMENTS

Treat `$ARGUMENTS` as exactly one repository-relative file path and run this exact workflow.

1. If the path does not end with `.ts` or `.tsx`, print exactly `SKIP: not a TypeScript source file` and stop.
2. If the path matches any of these patterns, print exactly `SKIP: excluded TypeScript file` and stop:
   - `*.spec.ts`
   - `*.spec.tsx`
   - `*.test.ts`
   - `*.test.tsx`
   - `*.d.ts`
   - `*.config.ts`
   - `*.config.tsx`
   - any path containing `/fixtures/`
   - any path containing `/__fixtures__/`
3. Walk upward from the file directory and stop at the nearest directory containing `package.json`. Use that directory as the package root.
4. If the file has no ancestor `package.json`, stop and report a blocker.
5. Convert the file path to a path relative to the package root.
6. From the package root, run exactly this command:
   `vitest related <file> --run --coverage.enabled --coverage.include=<file> --coverage.reporter=text`
7. Capture the raw Vitest `text` coverage output for that file.
8. This coverage check fails unless the raw output contains a coverage row for `<file>`.
9. This coverage check fails unless the coverage row for `<file>` shows all of the following:
   - `100` in `% Stmts`
   - `100` in `% Branch`
   - `100` in `% Funcs`
   - `100` in `% Lines`
10. This coverage check fails if the coverage row for `<file>` has any uncovered line numbers.
11. If the coverage check fails, print the raw failing Vitest `text` coverage output without summarizing it.
12. If the coverage check passes, print the raw Vitest `text` coverage output without summarizing it.
