import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type {
  CommandRunner,
  CommandRunResult,
} from "../source-control/changed-files.js"

export interface CapturedCoverageRun {
  executable: string
  commandArguments: string[]
  workingDirectory: string
}

export function createRepository(sourceFilePath: string): string {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-test-repo-"))
  const sourceAbsolutePath = path.join(repositoryRoot, sourceFilePath)
  const vitestBinaryPath = path.join(repositoryRoot, "node_modules", ".bin", "vitest")
  fs.mkdirSync(path.dirname(sourceAbsolutePath), { recursive: true })
  fs.mkdirSync(path.dirname(vitestBinaryPath), { recursive: true })
  fs.writeFileSync(path.join(repositoryRoot, "package.json"), "{}")
  fs.writeFileSync(sourceAbsolutePath, "export const answer = 42\n")
  fs.writeFileSync(vitestBinaryPath, "")
  return repositoryRoot
}

export function createRepositoryWithoutVitest(sourceFilePath: string): string {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-test-repo-"))
  const sourceAbsolutePath = path.join(repositoryRoot, sourceFilePath)
  fs.mkdirSync(path.dirname(sourceAbsolutePath), { recursive: true })
  fs.writeFileSync(path.join(repositoryRoot, "package.json"), "{}")
  fs.writeFileSync(sourceAbsolutePath, "export const answer = 42\n")
  return repositoryRoot
}

export function createRepositoryWithoutPackage(sourceFilePath: string): string {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-test-repo-"))
  const sourceAbsolutePath = path.join(repositoryRoot, sourceFilePath)
  fs.mkdirSync(path.dirname(sourceAbsolutePath), { recursive: true })
  fs.writeFileSync(sourceAbsolutePath, "export const answer = 42\n")
  return repositoryRoot
}

function createCoverageMetric(percent: number): Record<string, number> {
  return {
    total: 1,
    covered: percent === 100 ? 1 : 0,
    skipped: 0,
    pct: percent,
  }
}

function writeCoverageSummary(reportsDirectory: string, filePath: string, percent: number): void {
  fs.mkdirSync(reportsDirectory, { recursive: true })
  fs.writeFileSync(path.join(reportsDirectory, "coverage-summary.json"), JSON.stringify({
    total: {
      lines: createCoverageMetric(percent),
      statements: createCoverageMetric(percent),
      functions: createCoverageMetric(percent),
      branches: createCoverageMetric(percent),
    },
    [filePath]: {
      lines: createCoverageMetric(percent),
      statements: createCoverageMetric(percent),
      functions: createCoverageMetric(percent),
      branches: createCoverageMetric(percent),
    },
  }))
}

export function createCoverageCommandRunner(percent: number, capturedRuns: CapturedCoverageRun[], commandOutput = "coverage output"): CommandRunner {
  return {
    run(executable: string, commandArguments: string[], workingDirectory: string): CommandRunResult {
      capturedRuns.push({
        executable,
        commandArguments,
        workingDirectory,
      })
      const reportsDirectoryArgument = commandArguments.find((commandArgument) => commandArgument.startsWith("--coverage.reportsDirectory="))

      if (reportsDirectoryArgument === undefined) {
        return {
          status: 1,
          stdout: "",
          stderr: "missing reports directory",
        }
      }

      const reportsDirectory = reportsDirectoryArgument.replace("--coverage.reportsDirectory=", "")
      const coverageIncludeArgument = commandArguments.find((commandArgument) => commandArgument.startsWith("--coverage.include="))

      if (coverageIncludeArgument === undefined) {
        return {
          status: 1,
          stdout: "",
          stderr: "missing coverage include",
        }
      }

      const coveredFilePath = coverageIncludeArgument.replace("--coverage.include=", "")
      writeCoverageSummary(reportsDirectory, path.join(workingDirectory, coveredFilePath), percent)

      return {
        status: percent === 100 ? 0 : 1,
        stdout: commandOutput,
        stderr: "",
      }
    },
  }
}

export function createPullRequestCoverageCommandRunner(changedFiles: string[], percent: number): CommandRunner {
  return {
    run(executable: string, commandArguments: string[], workingDirectory: string): CommandRunResult {
      if (executable === "gh") {
        return {
          status: 0,
          stdout: changedFiles.join("\n"),
          stderr: "",
        }
      }

      return createCoverageCommandRunner(percent, []).run(executable, commandArguments, workingDirectory)
    },
  }
}

export function createCoverageSummaryCommandRunner(summaryJson: string): CommandRunner {
  return {
    run(_executable: string, commandArguments: string[]): CommandRunResult {
      const reportsDirectoryArgument = commandArguments.find((commandArgument) => commandArgument.startsWith("--coverage.reportsDirectory="))

      if (reportsDirectoryArgument !== undefined) {
        const reportsDirectory = reportsDirectoryArgument.replace("--coverage.reportsDirectory=", "")
        fs.mkdirSync(reportsDirectory, { recursive: true })
        fs.writeFileSync(path.join(reportsDirectory, "coverage-summary.json"), summaryJson)
      }

      return {
        status: 0,
        stdout: "",
        stderr: "",
      }
    },
  }
}

export function createCoverageErrorCommandRunner(): CommandRunner {
  return {
    run(): CommandRunResult {
      return {
        status: null,
        stdout: "coverage stdout",
        stderr: "coverage stderr",
        errorMessage: "spawn failed",
      }
    },
  }
}

export function installFailingVitestBinary(repositoryRoot: string): void {
  const vitestBinaryPath = path.join(repositoryRoot, "node_modules", ".bin", "vitest")
  const scriptContent = [
    "#!/usr/bin/env node",
    "const fs = require('node:fs')",
    "const path = require('node:path')",
    "const filePath = path.join(process.cwd(), process.argv[3])",
    "const reportsArgument = process.argv.find((argument) => argument.startsWith('--coverage.reportsDirectory='))",
    "const reportsDirectory = reportsArgument.replace('--coverage.reportsDirectory=', '')",
    "const metric = { total: 1, covered: 0, skipped: 0, pct: 50 }",
    "fs.mkdirSync(reportsDirectory, { recursive: true })",
    "fs.writeFileSync(path.join(reportsDirectory, 'coverage-summary.json'), JSON.stringify({ total: { lines: metric, statements: metric, functions: metric, branches: metric }, [filePath]: { lines: metric, statements: metric, functions: metric, branches: metric } }))",
    "process.stdout.write('tool coverage output')",
    "process.exit(1)",
  ].join("\n")
  fs.rmSync(vitestBinaryPath, { force: true })
  fs.writeFileSync(vitestBinaryPath, scriptContent, { mode: 0o755 })
}

export function removeDirectory(directoryPath: string): void {
  fs.rmSync(directoryPath, {
    recursive: true,
    force: true,
  })
}
