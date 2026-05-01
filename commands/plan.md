---
description: Create an implementation plan.
---

Plan request:
$ARGUMENTS

Create an implementation plan for the request. The plan must sequence value slices, not implementation layers.

## Clarification gate

Before creating the final plan, resolve every question that affects the plan.

First try to answer questions through available evidence:
- existing code
- source files and tests
- repository documentation
- issues and pull requests
- Notion pages
- linked design documents
- external API documentation
- related repositories mentioned by code or documentation

Do not ask the user questions already answered by evidence. Use the evidence and cite it in the plan.

Ask the user only when evidence cannot answer a plan-affecting question, or when the answer is a product or business decision.

Check for missing information that would change:
- the problem being solved
- user value
- scope
- explicit out-of-scope behavior
- constraints
- related code, docs, issues, Notion pages, or repositories
- dependencies or external systems
- acceptance and validation outcomes
- risks or edge cases

If any plan-affecting question remains after research, do not create the final plan. Respond only with this format:

```md
## Clarification needed

<brief explanation of what could not be resolved through research>

1. <question>
   Reason: <why this affects the plan>
   Why evidence could not answer it: <what was checked and why it was insufficient>
   Recommended: <optional recommendation with evidence, if available>
```

Ask at most 5 clarification questions in one response. Ask only questions that materially affect the plan. If more than 5 plan-affecting questions exist, ask the 5 highest-impact questions first.

A recommended answer is not an assumption. Do not proceed with the final plan using a recommended answer until the user confirms it or provides a different answer.

The final plan must not contain open questions.

## Research expectations

Search all relevant existing code and documentation before finalizing the plan. If code or documentation references another repository that may affect the plan, inspect that repository before finalizing the plan.

If a required repository, document, issue, Notion page, or other evidence source is inaccessible and that evidence affects the plan, stop and report the blocker using the clarification-needed format. Do not guess and do not create the final plan.

Do not search unrelated repositories.

Every factual claim about existing behavior, constraints, dependencies, or related systems must be backed by evidence from code, docs, issues, Notion pages, linked materials, or referenced repositories. If no evidence was found, do not state the claim as fact.

## Planning level

The proposed solution may discuss software and technical direction at a planning level. Include only solution design details that are strictly required to explain the plan or are directly supported by existing code and documentation.

Do not add new design elements just because they seem useful. Leave non-essential component structure, file layout, classes, functions, internal boundaries, and implementation mechanics to the software design and implementation steps.

Validation must describe observable outcomes and required quality gates. Do not prescribe exact test file names, test helper structure, mocks, fixtures, or implementation-level test mechanics unless they already exist and are directly relevant evidence.

## Value slices

A value slice is a user-observable capability or behavior.

Good value slice: "Fuzzy searching on first name".
Bad value slice: "Add data types".

For each slice, challenge whether it is necessary. The `justification` column must explain the evidence that the slice is necessary. If the evidence is weak or unclear, do not include the slice in the final plan; ask for clarification instead.

Tasks must be organized by value slice so each slice can be implemented and verified independently.

Map technical work to the value slice it supports. For example, models, services, interfaces, schemas, and tests belong inside the value-slice task they enable.

Do not create standalone top-level tasks for technical layers unless that task independently delivers user value.

Each value slice must include an independent verification outcome. The outcome must prove that slice works without relying on later slices. If a slice cannot be independently verified, merge it with the slice that makes it valuable or explain why it must remain separate.

## Output format

If the final output does not follow the required template exactly, the plan is invalid.

Do not add extra top-level sections. Do not rename headings. Do not omit required sections.

The final plan may use only these top-level headings:
- `## Context`
- `## Slices`
- `## Software design & architecture`
- `## Tasks`

Return exactly this Markdown structure:

```md
## Context

### Problem

<prose only; describe the problem being solved, not the solution>

### Evidence reviewed

<prose only; summarize the code, documentation, linked materials, and repositories that informed the plan. Include specific paths, document names, links, or repository names.>

### Constraints

<prose only; describe constraints, dependencies, existing materials, affected systems, and known limits>

### Proposed solution

<prose only; describe the intended technical direction at a planning level. Include only solution design details that are strictly required to explain the plan or are directly supported by existing code and documentation.>

## Slices

| slice | description | justification |
|---|---|---|
| <value slice> | <user-observable capability or behavior> | <evidence that this slice is necessary> |

## Software design & architecture

<software design and architecture>

## Tasks

- [ ] Task: <value slice>
  - [ ] Read the software design and architecture section before implementation.
  - [ ] Implement the value slice according to the software design and architecture.
  - [ ] Verify outcome: <observable behavior that proves the slice works independently>.
  - [ ] Verify the implementation aligns with the software design and architecture.
  - [ ] Run `nt_skillz_lint` on changed `.ts` and `.tsx` files.
  - [ ] Verify 100% test coverage using `/nt-skillz:vitest-coverage <file>`.
  - [ ] Commit the changes.
```

Tasks must be planning-level only. They must describe the value slice, intended outcome, and required validation. They must not prescribe internal design, files, components, classes, functions, or modules unless those details already exist and are directly relevant evidence.

## Final self-check

Before returning the final plan, verify:
- The output uses exactly the required top-level headings.
- The output does not add extra top-level sections.
- The Problem section contains no solution language.
- The Context subsections are prose, not bullet lists.
- The Evidence reviewed section names specific sources.
- The Slices table exists and every slice includes evidence-backed justification.
- Every task maps to exactly one value slice.
- Every task stays at planning level and avoids premature design details.
- Every task includes an observable verification outcome.
- The software design and architecture section contains only `<software design and architecture>`.
- No assumptions are presented as facts.
- No open questions remain.

After producing the final plan, stop. Do not implement. Do not run the software design and architecture step. Wait for the user to invoke the next command.

## Important notes

- Stop if the plan cannot be completed without unanswered plan-affecting questions.
- If parts of a plan are incomplete, missing, or placeholders other than `<software design and architecture>` remain, refuse to implement and tell the user.
- During implementation, ensure each subtask is marked off when complete.
