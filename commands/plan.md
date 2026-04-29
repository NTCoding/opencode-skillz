---
description: Create an implementation plan.
---

Plan:
$ARGUMENTS

Create a detailed implementation plan broken down into slices of functionality and not layer. Good Example: "Fuzzy searching on first name" is a slice of value. Bad Example: "Add data types" is just a layer of code that needs to be assembled later.

Search all relevant existing code. If some of the code is in other repos, look there as well. Don't be lazy, more too much research is better than not enough. If you're unsure ask the user. As a general rule, if the supporting documenting or existing code references another repository, you should almost certainly be looking there.

For each slide of value, challenge if it's needed. Find supporting evidence.

## Context

The plan starts with a context section explaining the problem that is being solved along with any relevant information like constraints. It also references any existing materials like notion pages. Context should be rich so that an engineer has all the information they need.

## Slices

List each slice of value that needs to be delivered and justify why it is necessary in a table with the column headings `slice`, `description`, `justification`.

## Task checklist

A plan is broken down into tasks. One task for each slice of value like "Fuzzy searching on first name" and each task is broken down into subtask. The task itself and each subtask are checklist items. This is crucial so that progress can be recorded by the engineer.

Tasks should be detailed so that an engineer has all the information they need to implement the task.

## Linting

Include a lint check before each commit:
- get the staged changed `.ts` and `.tsx` files
- run `nt_skillz_lint` on the changed files
- do not create the commit unless the lint check passes

## Test Coverage

Include a 100% Vitest coverage check before each commit:
- get the staged changed `.ts` and `.tsx` files
- ignore tests, declaration files, config files, and fixtures
- run `/nt-skillz:vitest-coverage <file>` for each remaining file
- do not create the commit unless every remaining file passes with 100% Vitest coverage

## Software design & architecture

Leave a placeholder `<software design and architecture>`.  This will be filled in by a following command.

### Template

```md
## Context

- Problem:
- Constraints:
- Related materials:

## Software design & architecture



## Tasks

- [ ] Task 1: <slice of functionality>
  - [ ] Subtask 1.1
  - [ ] Subtask 1.2
  - [ ] Run `nt_skillz_lint` on changed `.ts` and `.tsx` files
  - [ ] Verify 100% test coverage using  `/nt-skillz:vitest-coverage <file>`
  - [ ] Commit the changes
- [ ] Task 2: <slice of functionality>
  - [ ] Subtask 2.1
  - [ ] Subtask 2.2
  - [ ] Run `nt_skillz_lint` on changed `.ts` and `.tsx` files
  - [ ] Verify 100% test coverage using  `/nt-skillz:vitest-coverage <file>`
  - [ ] Commit the changes
```

## Important Notes

- Stop if you cannot implement the plan as described. If the proposed design or functionality will not work in practice, discuss with the user

- Ensure you mark of each subtask when complete

- If parts of the plan are incomplete, missing, or placeholders refuse to implement and tell the user. Do not implement a flawed plan
