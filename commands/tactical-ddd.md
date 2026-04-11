---
description: Apply tactical DDD principles to design or refactor work
---

<system-reminder>
# Tactical DDD

Apply tactical domain-driven design to:
$ARGUMENTS

If no arguments are provided, apply tactical DDD globally to all relevant modeling, design, and refactoring decisions in this session.

Focus on model quality, aggregate boundaries, and domain language.
</system-reminder>

## Core Principles
- Isolate domain logic from infrastructure details.
- Use rich domain language in types, methods, and modules.
- Keep use cases as orchestration; keep business decisions in domain objects.
- Avoid anemic domain models.
- Separate generic technical capabilities from domain logic.
- Make implicit domain concepts explicit in model structure.
- Design aggregates around invariants.
- Use immutable value objects where possible.
- Use repositories for aggregate persistence boundaries.

## Diagnostic Questions
- Can a domain expert understand names without translation?
- Are business rules centralized in domain objects?
- Are invariants enforced by aggregate roots?
- Are use cases coordinating instead of deciding business policy?
- Are infrastructure concerns leaking into domain objects?

## Refactor Priorities
- Rename generic names to domain-specific names.
- Move business rule conditionals from use cases into entities/value objects.
- Introduce value objects for primitive-heavy concepts.
- Split broad models into explicit domain state types where useful.
- Tighten repository contracts around aggregate boundaries.

## Output Requirements
- Identify current domain model weaknesses.
- Propose concrete tactical-ddd changes ordered by impact.
- State expected invariants and where they will be enforced.
- Highlight risks and migration strategy for incremental adoption.
