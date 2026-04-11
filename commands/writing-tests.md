---
description: Apply test-writing standards and edge-case coverage
---

<system-reminder>
# Writing Tests

Apply these test quality standards to:
$ARGUMENTS

If no arguments are provided, apply these standards globally to all tests written or reviewed in this session.

Focus on behavior clarity, strong assertions, and edge-case coverage.
</system-reminder>

## Naming Rules
- Test names describe outcomes, not actions.
- Use pattern: "[outcome] when [condition]".
- One concept per test.

## Assertion Rules
- Assertions must match test title claims.
- Prefer specific value assertions over weak existence/type assertions.
- Avoid tests coupled to implementation details unless behavior depends on them.

## Structure
- Use Arrange -> Act -> Assert.
- Keep test setup explicit and minimal.
- Separate independent behaviors into separate tests.

## Edge-Case Checklist
Consider relevant cases from these groups:
- Numbers: zero, negatives, boundaries, NaN, Infinity.
- Strings: empty, whitespace, unicode, very long values, escaping.
- Collections: empty, single, duplicates, nested, large.
- Date/time: timezone, DST, invalid dates, boundary transitions.
- Nullability: null, undefined, missing optional fields.
- Domain constraints: uniqueness, ordering, state consistency, range limits.

## Bug Clustering Rule
When one bug is found, add tests for nearby scenarios likely to share the same mistaken assumption.

## Output Requirements
- List missing test scenarios before adding tests.
- Explain why each added test matters.
- Show failing and passing evidence when operating in TDD flow.
