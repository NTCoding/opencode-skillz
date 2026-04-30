import fs from "node:fs"
import path from "node:path"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import {
  runVitestCoverageReview,
} from "./vitest-coverage.js"
import { vitestCoverageTool } from "./vitest-coverage-tool.js"
import type { CommandRunResult } from "./pull-request-files.js"
import {
  type CapturedCoverageRun,
  createCoverageCommandRunner,
  createCoverageSummaryCommandRunner,
  createRepository,
  createRepositoryWithoutVitest,
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

  it("executes root Vitest binary when source file belongs to nested package without local Vitest", async () => {
    const repositoryRoot = createRepository("apps/example-app/src/covered.ts")
    const packageRoot = path.join(repositoryRoot, "apps", "example-app")
    const capturedRuns: CapturedCoverageRun[] = []
    fs.writeFileSync(path.join(packageRoot, "package.json"), "{}")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        mode: "files",
        files: ["apps/example-app/src/covered.ts"],
      }, {
        commandRunner: createCoverageCommandRunner(100, capturedRuns),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("| `apps/example-app/src/covered.ts` | 100% | 100% | 100% | 100% | PASS |")
      expect(capturedRuns[0].executable).toBe(path.join(repositoryRoot, "node_modules", ".bin", "vitest"))
      expect(capturedRuns[0].workingDirectory).toBe(packageRoot)
      expect(capturedRuns[0].commandArguments).toContain("--coverage.include=src/covered.ts")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("executes nested Vitest binary when source package has local Vitest", async () => {
    const repositoryRoot = createRepository("apps/example-app/src/covered.ts")
    const packageRoot = path.join(repositoryRoot, "apps", "example-app")
    const nestedVitestBinaryPath = path.join(packageRoot, "node_modules", ".bin", "vitest")
    const capturedRuns: CapturedCoverageRun[] = []
    fs.writeFileSync(path.join(packageRoot, "package.json"), "{}")
    fs.mkdirSync(path.dirname(nestedVitestBinaryPath), { recursive: true })
    fs.writeFileSync(nestedVitestBinaryPath, "")

    try {
      await runVitestCoverageReview({
        repositoryRoot,
        mode: "files",
        files: ["apps/example-app/src/covered.ts"],
      }, {
        commandRunner: createCoverageCommandRunner(100, capturedRuns),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(capturedRuns[0].executable).toBe(nestedVitestBinaryPath)
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("reports every searched Vitest binary path when nested package and root have no Vitest", async () => {
    const repositoryRoot = createRepositoryWithoutVitest("apps/example-app/src/no-vitest.ts")
    const packageRoot = path.join(repositoryRoot, "apps", "example-app")
    fs.writeFileSync(path.join(packageRoot, "package.json"), "{}")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        mode: "files",
        files: ["apps/example-app/src/no-vitest.ts"],
      }, {
        commandRunner: createCoverageCommandRunner(100, []),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.results[0].status).toBe("errored")
      expect(outcome.markdown).toContain("Expected Vitest binary in one of:")
      expect(outcome.markdown).toContain(path.join(repositoryRoot, "apps", "example-app", "node_modules", ".bin", "vitest"))
      expect(outcome.markdown).toContain(path.join(repositoryRoot, "node_modules", ".bin", "vitest"))
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
        output: expect.stringContaining("<details><summary>Coverage output for `src/tool-failed.ts`</summary>"),
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

describe("createCoverageCommandRunner", () => {
  it("returns missing reports directory error when coverage reports argument is absent", () => {
    const capturedRuns: CapturedCoverageRun[] = []
    const commandRunner = createCoverageCommandRunner(100, capturedRuns)

    const commandResult = commandRunner.run("vitest", ["related", "src/missing.ts"], "/repository")

    expect(commandResult).toStrictEqual({
      status: 1,
      stdout: "",
      stderr: "missing reports directory",
    })
    expect(capturedRuns).toStrictEqual([{
      executable: "vitest",
      commandArguments: ["related", "src/missing.ts"],
      workingDirectory: "/repository",
    }])
  })
})

describe("createCoverageSummaryCommandRunner", () => {
  it("returns success without writing summary when coverage reports argument is absent", () => {
    const commandRunner = createCoverageSummaryCommandRunner("{}")

    const commandResult = commandRunner.run("vitest", ["related", "src/missing.ts"], "/repository")

    expect(commandResult).toStrictEqual({
      status: 0,
      stdout: "",
      stderr: "",
    })
  })
})
