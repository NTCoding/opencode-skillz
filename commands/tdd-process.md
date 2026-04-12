---
description: "Strict test-driven development state machine with red-green-refactor cycles. Enforces test-first development, meaningful failures, minimum implementations, and full verification. Activates when user requests: 'use a TDD approach', 'start TDD', 'test-drive this'."
---

Use the following TDD process to implement all code changes.

**In Plan Mode: Plans should be test specifications, not implementation designs. Include key insights, architectural constraints, and suggestions—but never the full implementation of production code.**

# 🚨 CRITICAL: TDD STATE MACHINE GOVERNANCE 🚨

**EVERY SINGLE MESSAGE MUST START WITH YOUR CURRENT TDD STATE**

Format:
```
🔴 TDD: RED
🟢 TDD: GREEN
🔵 TDD: REFACTOR
⚪ TDD: PLANNING
🟡 TDD: VERIFY
⚠️ TDD: BLOCKED
```

**NOT JUST THE FIRST MESSAGE. EVERY. SINGLE. MESSAGE.**

When you read a file → prefix with TDD state
When you run tests → prefix with TDD state
When you explain results → prefix with TDD state
When you ask a question → prefix with TDD state

Example:
```
⚪ TDD: PLANNING
Writing test for negative price validation...

⚪ TDD: PLANNING
Running npm test to see it fail...

⚪ TDD: PLANNING
Test output shows: Expected CannotHaveNegativePrice error but received -50
Test fails correctly. Transitioning to RED.

🔴 TDD: RED
Test IS failing. Addressing what the error message demands...
```

**🚨 FAILURE TO ANNOUNCE TDD STATE = SEVERE VIOLATION 🚨**

---

<meta_governance>
  🚨 STRICT STATE MACHINE GOVERNANCE 🚨

  - CANNOT skip states or assume completion without evidence
  - MUST announce state on EVERY message
  - MUST validate post-conditions before transitioning

  **Before each response:** Verify your claimed state matches your tool call evidence.
  If mismatch: `🔥 STATE VIOLATION DETECTED` → announce correct state → recover.

  **State announcement:** Every message starts with `🔴 TDD: RED` (or current state).
  Forgot prefix? Announce violation immediately, then continue.
</meta_governance>

<state_machine>
  <diagram>
```
                  user request
                       ↓
                 ┌──────────┐
            ┌────│ PLANNING │────┐
            │    └─────┬────┘    │
            │          │         │
            │  test fails        │
            │  correctly         │
  unclear   │          ↓         │ blocker
            │    ┌──────────┐    │
            └────│   RED    │    │
                 │          │    │
                 │ Test IS  │    │
                 │ failing  │    │
                 └────┬─────┘    │
                      │          │
              test    │          │
              passes  │          │
                      ↓          │
                 ┌──────────┐    │
                 │  GREEN   │    │
                 │          │    │
                 │ Test IS  │    │
                 │ passing  │    │
                 └────┬─────┘────┘
                      │
          refactoring │
          needed      │
                      ↓
                 ┌──────────┐
            ┌────│ REFACTOR │
            │    │          │
            │    │ Improve  │
            │    │ design   │
            │    └────┬─────┘
            │         │
            │    done │
            │         │
            │         ↓
            │    ┌──────────┐
            │    │  VERIFY  │
            │    │          │
            │    │ Run full │
  fail      │    │ suite +  │
            │    │ lint +   │
            └────│ build    │
                 └────┬─────┘
                      │
                 pass │
                      │
                      ↓
                 [COMPLETE]
```
  </diagram>

  <states>
    <state name="PLANNING">
      <prefix>⚪ TDD: PLANNING</prefix>
      <purpose>Writing a failing test to prove requirement</purpose>

      <pre_conditions>
        ✓ User has provided a task/requirement/bug report
        ✓ No other TDD cycle in progress
      </pre_conditions>

      <actions>
        1. Analyze requirement/bug
        2. Ask clarifying questions if needed
        3. Determine what behavior needs testing
        4. Identify edge cases using writing-tests skill checklists (numbers, strings, collections, dates, null/undefined, typed property validation)
        5. Write test for specific behavior
        6. Run test (use Bash tool to execute test command)
        7. VERIFY test fails correctly
        8. Show exact failure message to user (copy/paste verbatim output)
        9. Justify why failure message proves test is correct
        10. If failure is "method doesn't exist" - implement empty/dummy method and re-run from step 6
        11. Repeat until you get a "meaningful" failure
        12. Improve the code to produce a more explicit error message. Does the test failure provide a precise reason for the failure, if not ask the user if they want to make it better.
        13. Transition to RED
      </actions>

      <post_conditions>
        ✓ Test written and executed
        ✓ Test FAILED correctly (red bar achieved)
        ✓ Failure message shown to user verbatim
        ✓ Failure reason justified (proves test is correct)
        ✓ Failure is "meaningful" (not setup/syntax error)
      </post_conditions>

      <validation_before_transition>
        BEFORE transitioning to RED, announce:
        "Pre-transition validation:
        ✓ Test written: [yes]
        ✓ Test executed: [yes]
        ✓ Test failed correctly: [yes]
        ✓ Failure message shown: [yes - output above]
        ✓ Meaningful failure: [yes - justification]

        Transitioning to RED - test is now failing for the right reason."
      </validation_before_transition>

      <transitions>
        - PLANNING → RED (when test fails correctly - red milestone achieved)
        - PLANNING → BLOCKED (when cannot write valid test)
      </transitions>
    </state>

    <state name="RED">
      <prefix>🔴 TDD: RED</prefix>
      <purpose>Test IS failing for the right reason. Implement ONLY what the error message demands.</purpose>

      🚨 CRITICAL: You are in RED state - test IS CURRENTLY FAILING. You MUST implement code and see test PASS, code COMPILE, code LINT before transitioning to GREEN.
      DO NOT transition to GREEN until you have:
      1. Implemented ONLY what the error message demands
      2. Executed the test with Bash tool
      3. Seen the SUCCESS output (green bar)
      4. Executed compile check and seen SUCCESS
      5. Executed lint check and seen PASS
      6. Shown all success outputs to the user

      <pre_conditions>
        ✓ Test written and executed (from PLANNING)
        ✓ Test IS FAILING correctly (red bar visible)
        ✓ Failure message shown and justified
        ✓ Failure is "meaningful" (not setup/syntax error)
      </pre_conditions>

      <actions>
        1. Read the error message - what does it literally ask for?
        2. 🚨 MANDATORY SELF-CHECK - announce before implementing:
           "Minimal implementation check:
           - Error demands: [what the error literally says]
           - Could hardcoded value work? [yes/no]
           - If yes: [what hardcoded value]
           - If no: [why real logic is required]"

           Guidelines:
           - If test asserts `x === 5` → return `5`
           - If test asserts `count === 0` → return object with `count: 0`
           - If test asserts type → return minimal stub of that type
           - Only add logic when tests FORCE you to (multiple cases, different inputs)
        3. Implement ONLY what that error message demands (hardcoded if possible)
        4. Do NOT anticipate future errors - address THIS error only
        5. Run test (use Bash tool to execute test command)
        6. VERIFY test PASSES (green bar)
        7. Show exact success message to user (copy/paste verbatim output)
        8. Run quick compilation check (e.g., tsc --noEmit, or project-specific compile command)
        9. Run lint on changed code
        10. If compile/lint fails: Fix issues and return to step 5 (re-run test)
        11. Show compile/lint success output to user
        12. Justify why implementation is minimum
        13. ONLY AFTER completing steps 5-12: Announce post-condition validation
        14. ONLY AFTER validation passes: Transition to GREEN

        🚨 YOU CANNOT TRANSITION TO GREEN UNTIL TEST PASSES, CODE COMPILES, AND CODE LINTS 🚨
      </actions>

      <post_conditions>
        ✓ Implemented ONLY what error message demanded
        ✓ Test executed
        ✓ Test PASSES (green bar - not red)
        ✓ Success message shown to user verbatim
        ✓ Code compiles (no compilation errors)
        ✓ Code lints (no linting errors)
        ✓ Compile/lint output shown to user
        ✓ Implementation addresses ONLY what error message demanded (justified)
      </post_conditions>

      <validation_before_transition>
        🚨 BEFORE transitioning to GREEN, verify ALL with evidence from tool history:
        ✓ Test PASSES (green bar) - show verbatim output
        ✓ Code compiles - show output
        ✓ Code lints - show output
        ✓ Implementation addresses ONLY what error demanded - justify

        If ANY evidence missing: "⚠️ CANNOT TRANSITION - Missing: [what]" → stay in RED.
      </validation_before_transition>

      <critical_rules>
        🚨 NEVER transition to GREEN without test PASS + compile SUCCESS + lint PASS
        🚨 IMPLEMENT ONLY WHAT THE ERROR MESSAGE DEMANDS - no anticipating future errors
        🚨 DON'T CHANGE TEST TO MATCH IMPLEMENTATION - fix the code, not the test
      </critical_rules>

      <transitions>
        - RED → GREEN (when test PASSES, code COMPILES, code LINTS - green milestone achieved)
        - RED → BLOCKED (when cannot make test pass or resolve compile/lint errors)
        - RED → PLANNING (when test failure reveals requirement was misunderstood)
      </transitions>
    </state>

    <state name="GREEN">
      <prefix>🟢 TDD: GREEN</prefix>
      <purpose>Test IS passing for the right reason. Assess code quality and decide next step.</purpose>

      <pre_conditions>
        ✓ Test exists and PASSES (from RED)
        ✓ Test IS PASSING for the right reason (green bar visible)
        ✓ Code compiles (no compilation errors)
        ✓ Code lints (no linting errors)
        ✓ Pass output was shown and implementation justified as minimum
      </pre_conditions>

      <actions>
        1. Review the implementation that made test pass
        2. Check code quality against object calisthenics
        3. Check for feature envy
        4. Check for dependency inversion opportunities
        5. Check naming conventions
        6. Decide: Does code need refactoring?
        7a. If YES refactoring needed → Transition to REFACTOR
        7b. If NO refactoring needed → Transition to VERIFY
      </actions>

      <post_conditions>
        ✓ Test IS PASSING (green bar)
        ✓ Code quality assessed
        ✓ Decision made: refactor or verify
      </post_conditions>

      <validation_before_transition>
        BEFORE transitioning to REFACTOR or VERIFY, announce:
        "Post-condition validation:
        ✓ Test IS PASSING: [yes - green bar visible]
        ✓ Code quality assessed: [yes]
        ✓ Decision: [REFACTOR needed / NO refactoring needed, go to VERIFY]

        All post-conditions satisfied. Transitioning to [REFACTOR/VERIFY]."

        IF any post-condition NOT satisfied:
        "⚠️ CANNOT TRANSITION - Post-condition failed: [which one]
        Staying in GREEN state to address: [issue]"
      </validation_before_transition>

      <critical_rules>
        🚨 GREEN state means test IS PASSING, code COMPILES, code LINTS - if any fail, you're back to RED
        🚨 NEVER skip code quality assessment
        🚨 NEVER transition if test is not passing
        🚨 NEVER transition if code doesn't compile or lint
        🚨 ALWAYS assess whether refactoring is needed
        🚨 Go to REFACTOR if improvements needed, VERIFY if code is already clean
      </critical_rules>

      <transitions>
        - GREEN → REFACTOR (when refactoring needed - improvements identified)
        - GREEN → VERIFY (when code quality satisfactory - no refactoring needed)
        - GREEN → RED (if test starts failing - regression detected, need new failing test)
      </transitions>
    </state>

    <state name="REFACTOR">
      <prefix>🔵 TDD: REFACTOR</prefix>
      <purpose>Tests ARE passing. Improving code quality while maintaining green bar.</purpose>

      <pre_conditions>
        ✓ Tests ARE PASSING (from GREEN)
        ✓ Code compiles (no compilation errors)
        ✓ Code lints (no linting errors)
        ✓ Refactoring needs identified
        ✓ Pass output was shown
      </pre_conditions>

      <actions>
        1. Analyze code for design improvements
        2. Check against project conventions
        3. Check naming conventions
        4. If improvements needed:
           a. Explain refactoring
           b. Apply refactoring
           c. Run test to verify behavior preserved
           d. Show test still passes
        5. Repeat until no more improvements
        6. Check tests for improvements opportunities - e.g. combine tests with it.each, check against project testing conventions (e.g. `/docs/conventions/testing.md`)
        7. Transition to VERIFY
      </actions>

      <post_conditions>
        ✓ Code reviewed for quality
        ✓ Object calisthenics applied
        ✓ No feature envy
        ✓ Dependencies inverted
        ✓ Names are intention-revealing
        ✓ Tests still pass after each refactor
        ✓ Test output shown after each refactor
      </post_conditions>

      <validation_before_transition>
        BEFORE transitioning to VERIFY, announce:
        "Post-condition validation:
        ✓ Object calisthenics: [applied/verified]
        ✓ Feature envy: [none detected]
        ✓ Dependencies: [properly inverted]
        ✓ Naming: [intention-revealing]
        ✓ Tests pass: [yes - output shown]

        All post-conditions satisfied. Transitioning to VERIFY."
      </validation_before_transition>

      <critical_rules>
        🚨 NEVER refactor without running tests after
        🚨 NEVER use generic names (data, utils, helpers)
        🚨 ALWAYS verify tests pass after refactor
      </critical_rules>

      <transitions>
        - REFACTOR → VERIFY (when code quality satisfactory)
        - REFACTOR → RED (if refactor broke test - write new test for edge case)
        - REFACTOR → BLOCKED (if cannot refactor due to constraints)
      </transitions>
    </state>

    <state name="VERIFY">
      <prefix>🟡 TDD: VERIFY</prefix>
      <purpose>Tests ARE passing. Run full test suite + lint + build before claiming complete.</purpose>

      <pre_conditions>
        ✓ Tests ARE PASSING (from GREEN or REFACTOR)
        ✓ Code compiles (no compilation errors)
        ✓ Code lints (no linting errors)
        ✓ Either: Refactoring complete OR no refactoring needed
      </pre_conditions>

      <actions>
        1. Run full test suite (not just current test)
        2. Capture and show output
        3. Run lint
        4. Capture and show output
        5. Run build
        6. Capture and show output
        7. If ALL pass → Transition to COMPLETE
        8. If ANY fail → Transition to BLOCKED or RED
      </actions>

      <post_conditions>
        ✓ Full test suite executed
        ✓ All tests PASSED
        ✓ Test output shown
        ✓ Lint executed
        ✓ Lint PASSED
        ✓ Lint output shown
        ✓ Build executed
        ✓ Build SUCCEEDED
        ✓ Build output shown
      </post_conditions>

      <validation_before_completion>
        BEFORE claiming COMPLETE, announce:
        "Final validation:
        ✓ Full test suite: [X/X tests passed - output shown]
        ✓ Lint: [passed - output shown]
        ✓ Build: [succeeded - output shown]

        All validation passed. TDD cycle COMPLETE.

        Session Summary:
        - Tests written: [count]
        - Refactorings: [count]
        - Violations: [count]
        - Duration: [time]

        Next: Check if project defines a task workflow. If so, follow it to completion."

        IF any validation FAILED:
        "⚠️ VERIFICATION FAILED
        Failed check: [which one]
        Output: [failure message]

        Routing to: [RED/BLOCKED depending on issue]"
      </validation_before_completion>

      <critical_rules>
        🚨 NEVER claim complete without full test suite
        🚨 NEVER claim complete without lint passing
        🚨 NEVER claim complete without build passing
        🚨 ALWAYS show output of each verification
        🚨 NEVER skip verification steps
      </critical_rules>

      <transitions>
        - VERIFY → COMPLETE (when all checks pass)
        - VERIFY → RED (when tests fail - regression detected)
        - VERIFY → REFACTOR (when lint fails - code quality issue)
        - VERIFY → BLOCKED (when build fails - structural issue)
      </transitions>
    </state>

    <state name="BLOCKED">
      <prefix>⚠️ TDD: BLOCKED</prefix>
      <purpose>Handle situations where progress cannot continue</purpose>

      <pre_conditions>
        ✓ Encountered issue preventing progress
        ✓ Issue is not user error or misunderstanding
      </pre_conditions>

      <actions>
        1. Clearly explain blocking issue
        2. Explain which state you were in
        3. Explain what you were trying to do
        4. Explain why you cannot proceed
        5. Suggest possible resolutions
        6. STOP and wait for user guidance
      </actions>

      <post_conditions>
        ✓ Blocker documented
        ✓ Context preserved
        ✓ Suggestions provided
        ✓ Waiting for user
      </post_conditions>

      <critical_rules>
        🚨 ALWAYS stop and wait for user
      </critical_rules>

      <transitions>
        - BLOCKED → [any state] (based on user guidance)
      </transitions>
    </state>

    <state name="VIOLATION_DETECTED">
      <prefix>🔥 TDD: VIOLATION_DETECTED</prefix>
      <purpose>Handle state machine violations</purpose>

      <trigger>
        Self-detected violations:
        - Forgot state announcement
        - Skipped state
        - Failed to validate post-conditions
        - Claimed phase complete without evidence
        - Skipped test execution
        - Changed assertion when test failed
        - Changed test assertion to match implementation (instead of fixing implementation)
        - Implemented full solution when hardcoded value would satisfy error
        - Skipped mandatory self-check before implementing
      </trigger>

      <actions>
        1. IMMEDIATELY announce: "🔥 STATE VIOLATION DETECTED"
        2. Explain which rule/state was violated
        3. Explain what you did wrong
        4. Announce correct current state
        5. Ask user permission to recover
        6. If approved, return to correct state
      </actions>

      <example>
        "🔥 STATE VIOLATION DETECTED

        Violation: Forgot to announce state on previous message
        Current actual state: RED

        Recovering to correct state...

        🔴 TDD: RED
        [continue from here]"
      </example>
    </state>
  </states>
</state_machine>

<rules>
  <rule id="1" title="No Green Without Proof">
    If you didn't see green test output, tests didn't pass. Compilation/type-checking ≠ tests pass.
  </rule>

  <rule id="2" title="Show and justify failure before RED">
    In PLANNING: run test, show exact failure message, explain why it's the RIGHT failure.
    "Database migration failed" = setup issue, not meaningful failure.
  </rule>

  <rule id="3" title="Error message driven implementation">
    Implement ONLY what the error message literally demands.
    ❌ Method missing → "not implemented" → full solution
    ✅ Method missing → return wrong value → assertion failure → hardcode correct value → add test → generalize

    Example techniques:
    - Return wrong value (null, 0, "") to get meaningful assertion failure
    - Hardcode expected value to pass, then add more tests to force real logic
    - Never jump from "not implemented" to full solution

    Concrete example:
    - Error: "Not implemented"
    - Test expects: componentCount: 0, linkCount: 0
    - ❌ WRONG: Implement real resume() with graph parsing logic
    - ✅ RIGHT: Return hardcoded stub `{ componentCount: 0, linkCount: 0 }`
    - Then: Add more tests to force real implementation
  </rule>

  <rule id="4" title="Predict user response">
    When asking questions, predict the answer: "Should I fix or skip? Given TDD context, you'll want option 1."
  </rule>

  <rule id="5" title="Green = test + lint + build">
    Never claim GREEN without all three passing and showing output.
  </rule>

  <rule id="6" title="Add observability">
    Add debug data (report objects, logging) so test failures are diagnosable.
  </rule>

  <rule id="7" title="Never change assertions to pass">
    Test fails? Fix IMPLEMENTATION, not test. Changing assertion = VIOLATION_DETECTED.
    If test is actually wrong: revert, fix test, re-implement.
  </rule>

  <rule id="8" title="Fail fast, no silent fallbacks">
    ❌ `value ?? backup ?? 'Unknown'` → ✅ `if (!value) throw Error('Expected value')`
  </rule>

  <rule id="9" title="No guessing">
    Never "probably". Add diagnostics, get evidence, report facts.
  </rule>

  <rule id="10" title="Minimal assertions">
    `expect(x).toBe('exact')` subsumes `toBeDefined()` and length checks. One strong assertion, not defensive scaffolding.
  </rule>

  <meta_rule>
    ALL rules enforced via state machine post-conditions.
    Skip validation → VIOLATION_DETECTED
  </meta_rule>

  <critical_reminders>
    🚨 EVERY message: state announcement
    🚨 NEVER skip transitions or claim pass/fail without output
    🚨 ALWAYS justify: does this address ONLY what error message demanded?
    🚨 NEVER change assertions to make tests pass
    🚨 NEVER guess - find evidence
    🚨 NEVER stop unless you are blocked or have completed the full task. Do not stop at red and wait for the user's permission to transition to green. You are autonomous, just do it.
  </critical_reminders>
</rules>
