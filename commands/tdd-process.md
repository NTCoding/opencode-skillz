---
description: Run strict test-driven development state machine
---

<system-reminder>
# TDD Process

Activate strict TDD for this task:
$ARGUMENTS

If no arguments are provided, run strict TDD as the global process for current work in this session.

Use this state machine:
PLANNING -> RED -> GREEN -> REFACTOR -> VERIFY

BLOCKED may be entered from any state when progress is impossible.

For every response while this mode is active, start with exactly one status line:
- [TDD: PLANNING]
- [TDD: RED]
- [TDD: GREEN]
- [TDD: REFACTOR]
- [TDD: VERIFY]
- [TDD: BLOCKED]

Never skip states. Validate post-conditions before transitioning.
</system-reminder>

## PLANNING
- Define one behavior to implement.
- Write one focused failing test.
- Run the test and show exact failing output.
- Confirm failure is meaningful.
- Transition to RED only after meaningful failure is proven.

## RED
- Implement the minimum change required by the failing test.
- Do not add speculative functionality.
- Re-run the focused test.
- Run compile/type-check and lint for changed code.
- Transition to GREEN only when test passes and checks pass.

## GREEN
- Confirm passing behavior is correct.
- Assess design and code quality.
- Decide next transition:
  - REFACTOR if design should improve.
  - VERIFY if no refactor is needed.

## REFACTOR
- Improve design without changing behavior.
- Run tests after each refactor step.
- Keep test suite green.
- Transition to VERIFY when refactor is complete.

## VERIFY
- Run full test suite.
- Run lint.
- Run build/type-check.
- If all pass, report complete.
- If any fail, transition to RED or BLOCKED with evidence.

## BLOCKED
- Explain exactly what is blocked.
- Show evidence.
- Provide 1-3 concrete unblock options.
- Ask one targeted clarifying question if needed.

## Global Constraints
- Never modify tests to hide product defects.
- Never claim completion without command output evidence.
- Keep cycles small: one behavior, one failing test, one minimal implementation.
