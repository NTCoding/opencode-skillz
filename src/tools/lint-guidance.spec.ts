import { describe, expect, it } from "vitest"
import { createLintFailureGuidance } from "./lint-guidance.js"

describe("createLintFailureGuidance", () => {
  it("returns generic guidance when lint rule has no targeted guidance", () => {
    const guidance = createLintFailureGuidance([{
      messages: [{ ruleId: "no-undef" }],
    }])

    expect(guidance).toBe([
      "Lint remediation guidance:",
      "- Do not sacrifice code quality or test coverage to satisfy lint rules.",
      "- These rules are not objectives; they are signs that code needs to be split, simplified, or clarified.",
      "- Fix the underlying design or test issue instead of deleting assertions, disabling rules, or reducing coverage.",
    ].join("\n"))
  })

  it("returns test-splitting guidance when test has too many assertions", () => {
    const guidance = createLintFailureGuidance([{
      messages: [
        { ruleId: "vitest/max-expects" },
        { ruleId: "max-lines" },
        { ruleId: "complexity" },
        { ruleId: "@typescript-eslint/no-explicit-any" },
        { ruleId: "@eslint-community/eslint-comments/no-use" },
      ],
    }])

    expect(guidance).toBe([
      "Lint remediation guidance:",
      "- Do not sacrifice code quality or test coverage to satisfy lint rules.",
      "- These rules are not objectives; they are signs that code needs to be split, simplified, or clarified.",
      "- Fix the underlying design or test issue instead of deleting assertions, disabling rules, or reducing coverage.",
      "",
      "Rule-specific guidance:",
      "- Do not delete required assertions or weaken expected values to reduce assertion count.",
      "- If several assertions describe one observable result, prefer one whole-result assertion such as `toEqual`, `toStrictEqual`, `toMatchObject`, or a domain-specific matcher.",
      "- If the test verifies multiple behaviours, split it into separate tests with outcome-focused names.",
      "- Do not combine unrelated checks into one object assertion just to satisfy this rule.",
      "- Do not delete required behavior, tests, setup, edge cases, or assertions to reduce line count.",
      "- Split by cohesive responsibility instead: production behavior, test fixture construction, assertions, adapters, or domain concepts.",
      "- For long spec files, extract fixture builders or split scenarios by behavior.",
      "- For long source files, extract named concepts that can be tested independently.",
      "- Do not move unrelated code into vague files such as utils, helpers, common, shared, or lib.",
      "- Do not remove branches, states, error handling, or edge cases to reduce complexity.",
      "- Reduce complexity by making decisions easier to read without changing behavior.",
      "- Use guard clauses, early returns, named predicates, or discriminated unions where they clarify the code.",
      "- If complexity comes from multiple states, model those states directly instead of stacking conditionals.",
      "- Keep all existing behavior, tests, and edge cases intact.",
      "- Do not replace `any` with `unknown as X`, non-null assertions, type assertions, or broader unsafe types.",
      "- Add precise types at the boundary where the value enters the system.",
      "- For external input, parse with Zod or an existing runtime validator.",
      "- For impossible states, change the type model instead of silencing the error.",
      "- Keep behavior unchanged and preserve existing validation.",
      "- Do not add code comments. They make the code noisy and are a workaround for poor code. Make code intention revealing so that comments are not necessary.",
      "- Do not add lint or TypeScript suppressions. The rules are non-negotiable. If the solution cannot be implemented while following the codebase rules, stop and ask for help.",
    ].join("\n"))
  })
})
