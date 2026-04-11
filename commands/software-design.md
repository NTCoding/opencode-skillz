---
description: Apply software design principles to current work
---

<system-reminder>
# Software Design Principles

Apply these design constraints to:
$ARGUMENTS

If no arguments are provided, apply these constraints globally to all current work in this session.

These are execution constraints, not optional suggestions.
</system-reminder>

## Critical Rules
- Fail fast over silent fallbacks.
- Do not use `any` or type assertions unless explicitly approved by the user.
- Make illegal states unrepresentable using types.
- Inject dependencies; do not instantiate dependencies inside domain behavior.
- Use intention-revealing names; avoid generic names like data, utils, helpers, manager, handler, processor.
- Prefer immutable transformations over mutation.
- Avoid speculative abstractions (YAGNI).

## Design Checks
- One behavior responsibility per method.
- Keep methods small and explicit.
- Prefer early returns instead of else-heavy nesting.
- Replace primitive obsession with value objects where useful.
- Detect feature envy: move behavior to the object that owns the data.
- Keep domain logic isolated from infrastructure concerns.

## Error Handling
- Validate assumptions explicitly.
- Throw clear errors with context instead of returning ambiguous defaults.
- Error format should identify expected value, actual value, and context.

## Type-Driven Modeling
- Represent domain states as explicit types.
- Use discriminated unions for mutually exclusive states.
- Use runtime validation for external input boundaries.

## Output Requirements
- State which rules were applied.
- Identify concrete code areas violating rules.
- Propose prioritized refactors with expected impact.
- If making changes, keep behavior unchanged unless user asks otherwise.
