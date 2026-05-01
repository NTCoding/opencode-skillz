import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { runVitestCoverageReview } from "./review.js"
import {
  createCoverageCommandRunner,
  createCoverageErrorCommandRunner,
  createCoverageSummaryCommandRunner,
  createPullRequestCoverageCommandRunner,
  createRepository,
  createRepositoryWithoutPackage,
  createRepositoryWithoutVitest,
  removeDirectory,
} from "./test-support.js"

describe("runVitestCoverageReview errors", () => {
  it("rejects invalid coverage mode", async () => {
    await expect(runVitestCoverageReview({
      mode: "unknown",
      files: [],
    })).rejects.toThrow("Expected coverage mode to be 'files' or 'pr-review'. Got unknown.")
  })

  it("uses files mode when mode contains only whitespace", async () => {
    const outcome = await runVitestCoverageReview({
      mode: "   ",
    })

    expect(outcome.markdown).toContain("No changed TypeScript source files.")
  })

  it("returns no source files markdown when files are omitted", async () => {
    const outcome = await runVitestCoverageReview({})

    expect(outcome.results).toStrictEqual([])
    expect(outcome.markdown).toContain("No changed TypeScript source files.")
  })

  it("returns pass row when pr-review mode resolves changed source files", async () => {
    const repositoryRoot = createRepository("src/reviewed.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        mode: "pr-review",
        pullRequest: "14",
      }, {
        commandRunner: createPullRequestCoverageCommandRunner(["src/reviewed.ts", "README.md"], 100),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("| `src/reviewed.ts` | 100% | 100% | 100% | 100% | PASS |")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns errored row when source file has no package ancestor", async () => {
    const repositoryRoot = createRepositoryWithoutPackage("src/no-package.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/no-package.ts"],
      })

      expect(outcome.markdown).toContain("Expected package.json ancestor")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns errored row when source file is outside repository root", async () => {
    const parentDirectory = createRepositoryWithoutPackage("outside.ts")
    const repositoryRoot = path.join(parentDirectory, "child")
    fs.mkdirSync(repositoryRoot)

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["../outside.ts"],
      })

      expect(outcome.markdown).toContain("Expected package.json ancestor")
    } finally {
      removeDirectory(parentDirectory)
    }
  })

  it("returns errored row when Vitest binary is missing", async () => {
    const repositoryRoot = createRepositoryWithoutVitest("src/no-vitest.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/no-vitest.ts"],
      })

      expect(outcome.markdown).toContain("Expected Vitest binary")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns errored row when coverage command cannot start", async () => {
    const repositoryRoot = createRepository("src/spawn-error.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/spawn-error.ts"],
      }, {
        commandRunner: createCoverageErrorCommandRunner(),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("spawn failed")
      expect(outcome.markdown).toContain("coverage stdout\ncoverage stderr")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns fallback error text when thrown value is not an error", async () => {
    const repositoryRoot = createRepository("src/string-error.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/string-error.ts"],
      }, {
        commandRunner: createCoverageCommandRunner(50, []),
        temporaryDirectoryCreator: () => {
          throw "directory failure"
        },
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("Expected coverage error message. Got directory failure.")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns errored row when coverage summary JSON is not an object", async () => {
    const repositoryRoot = createRepository("src/summary-array.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/summary-array.ts"],
      }, {
        commandRunner: createCoverageSummaryCommandRunner("[]"),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("Expected coverage summary JSON object.")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns errored row when coverage summary has no file row", async () => {
    const repositoryRoot = createRepository("src/missing-row.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/missing-row.ts"],
      }, {
        commandRunner: createCoverageSummaryCommandRunner("{\"total\":{}}"),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("Expected coverage summary row for src/missing-row.ts.")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns errored row when coverage file row is not an object", async () => {
    const repositoryRoot = createRepository("src/bad-row.ts")
    const filePath = path.join(repositoryRoot, "src/bad-row.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/bad-row.ts"],
      }, {
        commandRunner: createCoverageSummaryCommandRunner(JSON.stringify({ [filePath]: [] })),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("Expected file coverage summary object.")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns errored row when coverage metric is missing", async () => {
    const repositoryRoot = createRepository("src/missing-metric.ts")
    const filePath = path.join(repositoryRoot, "src/missing-metric.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/missing-metric.ts"],
      }, {
        commandRunner: createCoverageSummaryCommandRunner(JSON.stringify({ [filePath]: {} })),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("Expected coverage metric 'lines'.")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("returns errored row when coverage metric field is not numeric", async () => {
    const repositoryRoot = createRepository("src/bad-number.ts")
    const filePath = path.join(repositoryRoot, "src/bad-number.ts")
    const badMetric = {
      total: "one",
      covered: 1,
      skipped: 0,
      pct: 100,
    }

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/bad-number.ts"],
      }, {
        commandRunner: createCoverageSummaryCommandRunner(JSON.stringify({
          [filePath]: {
            lines: badMetric,
            statements: badMetric,
            functions: badMetric,
            branches: badMetric,
          },
        })),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).toContain("Expected numeric coverage field 'total'.")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })

  it("omits empty failure details when failed coverage command has no output", async () => {
    const repositoryRoot = createRepository("src/no-output.ts")

    try {
      const outcome = await runVitestCoverageReview({
        repositoryRoot,
        files: ["src/no-output.ts"],
      }, {
        commandRunner: createCoverageCommandRunner(50, [], ""),
        temporaryDirectoryCreator: fs.mkdtempSync,
        temporaryDirectoryRemover: removeDirectory,
      })

      expect(outcome.markdown).not.toContain("<details><summary>Coverage output")
    } finally {
      removeDirectory(repositoryRoot)
    }
  })
})
