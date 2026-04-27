---
description: Implement the requested changes or specified document with small-step lint verification
---

Implement:
$ARGUMENTS


Implement the required task to the highest standards possible. Do not take shortcuts, do not rush, do not jump to the easiest solution to make the code pass. Think carefully, explore options and write the code that is easiest to read, easiest change, and will not break in production.

## Linting

After each small TypeScript code change, call `nt_skillz_lint` for the changed `.ts` or `.tsx` file or files.

- all lint errors on new code must be addressed before continuing
- if the lint fails on existing code, ignore the error unless it is very close to the new code
- line-length limits do not count as existing code; if new code causes a file-length lint error, it must be fixed
