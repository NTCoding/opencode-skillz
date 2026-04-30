import { describe, expect, it } from "vitest"
import { runPrReviewLint } from "./lint-review.js"
import type {
  CommandRunner,
  CommandRunResult,
} from "./pull-request-files.js"

function createChangedFileRunner(changedFiles: string[]): CommandRunner {
  return {
    run(): CommandRunResult {
      return {
        status: 0,
        stdout: changedFiles.join("\n"),
        stderr: "",
      }
    },
  }
}

describe("runPrReviewLint", () => {
  it("returns pass markdown when changed TypeScript files have no lint output", async () => {
    const markdown = await runPrReviewLint({
      repositoryRoot: "/repo",
      pullRequest: "8",
    }, {
      commandRunner: createChangedFileRunner(["src/clean.ts", "README.md"]),
      lintRunner: async (request) => {
        expect(request.files).toStrictEqual(["src/clean.ts"])

        return {
          exitCode: 0,
          output: "",
        }
      },
    })

    expect(markdown).toBe([
      "<!-- nt-skillz-lint:start -->",
      "## Lint",
      "",
      "PASS: 1 changed TypeScript file(s).",
      "<!-- nt-skillz-lint:end -->",
    ].join("\n"))
  })

  it("returns failure markdown when lint runner reports errors", async () => {
    const markdown = await runPrReviewLint({
      repositoryRoot: "/repo",
      pullRequest: "8",
    }, {
      commandRunner: createChangedFileRunner(["src/broken.ts"]),
      lintRunner: async () => ({
        exitCode: 1,
        output: "src/broken.ts\n  1:1  error  Example failure",
      }),
    })

    expect(markdown).toContain("FAIL: 1 changed TypeScript file(s).")
    expect(markdown).toContain("src/broken.ts\n  1:1  error  Example failure")
    expect(markdown).toContain("<!-- nt-skillz-lint:end -->")
  })

  it("returns pass markdown with details when lint runner reports warnings", async () => {
    const markdown = await runPrReviewLint({
      repositoryRoot: "/repo",
      pullRequest: "8",
    }, {
      commandRunner: createChangedFileRunner(["src/warned.ts"]),
      lintRunner: async () => ({
        exitCode: 0,
        output: "src/warned.ts\n  1:1  warning  Example warning",
      }),
    })

    expect(markdown).toContain("PASS: 1 changed TypeScript file(s).")
    expect(markdown).toContain("src/warned.ts\n  1:1  warning  Example warning")
  })

  it("uses current working directory when repository root is omitted", async () => {
    const markdown = await runPrReviewLint({
      pullRequest: "8",
    }, {
      commandRunner: createChangedFileRunner(["src/current.ts"]),
      lintRunner: async (request) => {
        expect(request.repositoryRoot).toBe(process.cwd())

        return {
          exitCode: 0,
          output: "",
        }
      },
    })

    expect(markdown).toContain("PASS: 1 changed TypeScript file(s).")
  })

  it("returns no changed TypeScript files markdown when pull request changes only markdown", async () => {
    const markdown = await runPrReviewLint({
      repositoryRoot: "/repo",
      pullRequest: "8",
    }, {
      commandRunner: createChangedFileRunner(["README.md"]),
      lintRunner: async () => ({
        exitCode: 0,
        output: "No TypeScript files matched.",
      }),
    })

    expect(markdown).toBe([
      "<!-- nt-skillz-lint:start -->",
      "## Lint",
      "",
      "No changed TypeScript files.",
      "<!-- nt-skillz-lint:end -->",
    ].join("\n"))
  })
})
