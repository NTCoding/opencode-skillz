import fs from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import {
  runVitestCoverageReview,
  vitestCoverageTool,
} from "./vitest-coverage.js"
import type { CommandRunResult } from "./pull-request-files.js"
import {
  type CapturedCoverageRun,
  createCoverageCommandRunner,
  createRepository,
  installFailingVitestBinary,
  removeDirectory,
} from "./vitest-coverage-test-support.js"

describe("runVitestCoverageReview", () => {
  it("returns no source files markdown when changed files are not coverable TypeScript sources", async () => {
    const repositoryRoot = createRepository("src/ignored.spec.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        mode: "files",
        files: ["README.md", "src/ignored.spec.ts"],
      })

      expect(outcome.markdown).toBe([
        "<!-- nt-skillz-coverage:start -->",
        "## Coverage",
        "",
        "No changed TypeScript source files.",
        "<!-- nt-skillz-coverage:end -->",
      ].join("\n"))
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns pass table row when source file has complete coverage", async () => {
    const repositoryRoot = createRepository("src/covered.ts")
    const capturedRuns: CapturedCoverageRun[] = []

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        mode: "files",
        files: ["src/covered.ts"],
      }, {
        commandRunner: createCoverageCommandRunner(100, capturedRuns),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("| `src/covered.ts` | 100% | 100% | 100% | 100% | PASS |")
      expect(capturedRuns[0].commandArguments).toContain("--coverage.include=src/covered.ts")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns failure details when source file has incomplete coverage", async () => {
    const repositoryRoot = createRepository("src/incomplete.ts")
    const capturedRuns: CapturedCoverageRun[] = []

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        mode: "files",
        files: ["src/incomplete.ts"],
      }, {
        commandRunner: createCoverageCommandRunner(50, capturedRuns),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("| `src/incomplete.ts` | 50% | 50% | 50% | 50% | FAIL |")
      expect(outcome.markdown).toContain("coverage output")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns errored row when coverage summary is missing", async () => {
    const repositoryRoot = createRepository("src/error.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        mode: "files",
        files: ["src/error.ts"],
      }, {
        commandRunner: {
          run(): CommandRunResult {
            return {
              status: 0,
              stdout: "",
              stderr: "",
            }
          },
        },
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("| `src/error.ts` | error | error | error | error | ERROR |")
      expect(outcome.markdown).toContain("Expected coverage summary")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })
})

describe("vitestCoverageTool", () => {
  it("returns markdown output when tool execute receives file mode request", async () => {
    const repositoryRoot = createRepository("src/tool.ts")

    try {
      const toolResult = await vitestCoverageTool.execute({
        mode: "files",
        files: [],
      }, {
        sessionID: "session",
        messageID: "message",
        agent: "agent",
        directory: repositoryRoot,
        worktree: repositoryRoot,
        abort: new AbortController().signal,
        metadata: () => undefined,
        ask: () => Effect.void,
      })

      expect(toolResult).toStrictEqual({
        output: [
          "<!-- nt-skillz-coverage:start -->",
          "## Coverage",
          "",
          "No changed TypeScript source files.",
          "<!-- nt-skillz-coverage:end -->",
        ].join("\n"),
        metadata: {
          fileCount: 0,
          failedCount: 0,
        },
      })
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns failed metadata count when tool execute runs failing coverage", async () => {
    const repositoryRoot = createRepository("src/tool-failed.ts")
    installFailingVitestBinary(repositoryRoot)

    try {
      const toolResult = await vitestCoverageTool.execute({
        mode: "files",
        files: ["src/tool-failed.ts"],
      }, {
        sessionID: "session",
        messageID: "message",
        agent: "agent",
        directory: repositoryRoot,
        worktree: repositoryRoot,
        abort: new AbortController().signal,
        metadata: () => undefined,
        ask: () => Effect.void,
      })

      expect(toolResult).toStrictEqual({
        output: [
          "<!-- nt-skillz-coverage:start -->",
          "## Coverage",
          "",
          "| File | Statements | Branches | Functions | Lines | Status |",
          "| --- | ---: | ---: | ---: | ---: | --- |",
          "| `src/tool-failed.ts` | error | error | error | error | ERROR |",
          "",
          "<details><summary>Coverage output for `src/tool-failed.ts`</summary>",
          "",
          "```text",
          "Expected coverage summary row for src/tool-failed.ts.",
          "```",
          "",
          "</details>",
          "<!-- nt-skillz-coverage:end -->",
        ].join("\n"),
        metadata: {
          fileCount: 1,
          failedCount: 1,
        },
      })
    } finally {
      removeDirectory(repositoryRoot)
    }
  })
})
