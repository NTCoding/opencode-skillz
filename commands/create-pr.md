---
description: Create a draft pull request with semantic commits, source-of-truth references, and check monitoring
---

Create a draft pull request for the current branch.

## Stop and ask the user if any of the following are true

- The source of truth is missing or unclear
- The ticket, plan, or design document cannot be found
- The acceptance criteria cannot be copied from the source material
- The branch contains unrelated changes that do not belong in the same pull request
- The base branch is unclear
- The change requires assumptions about user value, scope, or design intent
- An existing commit title already on the branch does not comply with the required commit title format and fixing it would require rewriting history

## Required context gathering

Before creating commits or a pull request:

1. Review the current git status
2. Review staged and unstaged diffs
3. Review the branch divergence from the base branch
4. Review every commit that will be included in the pull request
5. Review the source-of-truth materials for the change:
   - ticket, such as JIRA
   - plan
   - design document
   - any linked supporting document required to understand the change

Do not create the pull request until the change scope and source documents are understood.

## Local changes before pull request creation

The pull request must not be created with uncommitted local changes.

If local changes exist:

1. Group them into coherent commits
2. Create the required semantic commits
3. Verify the working tree is clean

Do not create the pull request until `git status` is clean.

## Commit title rules

Every commit included in the pull request must use the commit title format defined below.

Use semantic commit types:

- `feat`
- `fix`
- `refactor`
- `perf`
- `docs`
- `test`
- `build`
- `ci`
- `release`
- `chore`

Rules:

- Never use `chore` when the change includes a version bump or release preparation
- Use `release` for version bumps or release preparation work
- Use the smallest accurate scope
- The commit subject must describe the user-facing change or the real engineering outcome
- Commit bodies are optional
- Do not require existing commits to contain body sections

Commit title format:

`<type>(<scope>): <short summary>`

## Pull request title

Use a clear title that matches the real change. Reuse the best semantic commit subject when that is the best title.

## Pull request description

The pull request description must contain these sections in this order:

- `## Problem`
- `## Solution`
- `## Acceptance Criteria`
- `## Architecture and software design`

### `## Problem`

Include:

- all relevant source-of-truth references
- the actual user problem, business problem, or operational problem
- the value of solving it

### `## Solution`

Include:

- the selected solution
- why this approach solves the problem
- important constraints or tradeoffs that matter to reviewers

### `## Acceptance Criteria`

Rules:

- copy the acceptance criteria from the source ticket or plan
- do not invent new criteria without stating that they are additional reviewer notes
- do not paraphrase loosely if exact wording exists in the source material

Acceptance criteria describe verifiable outcomes like "Users can log i with their email address". An acceptance criteria is not an implementation instruction like "Add a script that accepts the same parameters". If you find yourself using workds like "add", "modify" in "acceptance criteria" stop and ask for help.

### `## Architecture and software design`

Describe major architectural changes like:

1. Which packages / modules were added, removed, or impacted?
2. Which components were added / modified inside each module and why?
3. Are there any significant domain model changes (new concepts, changes to terminology)
4. New or modified depeendecies between components
5. New or modified dependencies on other services or libraries

## Execution steps

1. Confirm the branch is ready for a pull request
2. If local changes exist, stage the relevant changes and create the required semantic commits until the working tree is clean
3. Verify every commit included in the pull request complies with the required commit title format
4. Push the branch if needed
5. Create a draft pull request with the required description format
6. Return the pull request URL
7. Wait for pull request checks to complete
8. Report the final status

Create the pull request as a draft.

## Check monitoring

After creating the draft pull request:

- wait for the pull request checks to finish
- do not report success before the checks complete
- if checks fail, report the failing checks and their status
- if checks pass, report that the draft pull request is ready for review
- do not merge unless the user explicitly asks for a merge

## Output

At the end, provide:

- the commit messages used for commits created during this command
- the pull request title
- the pull request URL
- the final check status
- any blockers that still require user action
