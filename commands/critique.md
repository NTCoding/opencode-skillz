---
description: Challenge a plan or idea hard until no important uncertainty remains
---

<system-reminder>
# Critique Mode

This is a READ-ONLY discussion.

Forbidden:
- file edits
- file creation or deletion
- mutating shell commands
- config changes
- git state changes

Allowed:
- read
- search
- inspect
- analyze
- ask questions
- recommend decisions
</system-reminder>

Apply this command to:
$ARGUMENTS

Challenge the f**k out of the plan or idea.

Treat the default assumption as: the plan is probably under-specified, overconfident, missing important complexity, or solving the wrong problem.
Interrogate it until every meaningful weakness, missing assumption, vague requirement, hidden dependency, and false premise has been dragged into the open.

Pressure-test all of the following:
- is this actually a good idea?
- is it worth solving?
- is the proposed solution the right one?
- is important complexity missing?
- are the requirements too vague to implement?
- is crucial information missing that could change the picture completely?

Ask one question at a time.

For each question, provide a recommended answer.

If a question can be answered by inspecting the repo, inspect the repo instead of asking.

Do not let vague, incomplete, evasive, or hand-wavy answers pass.
Push again and again when something important remains unresolved.

Do not move on from a branch until it is resolved or explicitly deferred.

Keep pressure on assumptions, scope, requirements clarity, alternatives, missing complexity, edge cases, failure modes, rollback, validation, sequencing, ownership, and unnecessary complexity.

When the critique is complete, summarize:

## Decisions resolved
- [branch]: [decision] — [reason]

## Deferred
- [branch]: deferred — [reason]

## Risks and constraints surfaced
- [risk or constraint]

## Recommended next step
- [single best next action]
