import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import {
  childProcessCommandRunner,
  type CommandRunner,
  resolvePullRequestChangedFiles,
} from "./pull-request-files.js"

export const VITEST_COVERAGE_TOOL_NAME = "nt_skillz_vitest_coverage"

interface CoverageRequest {
  repositoryRoot?: string
  files?: string[]
  mode?: string
  pullRequest?: string
  base?: string
  head?: string
}

interface CoverageMetric {
  total: number
  covered: number
  skipped: number
  pct: number
}

interface FileCoverageSummary {
  lines: CoverageMetric
  statements: CoverageMetric
  functions: CoverageMetric
  branches: CoverageMetric
}

interface CoverageCommandResult {
  status: number | null
  output: string
  errorMessage?: string
}

interface CoverageExecutionEnvironment {
  commandRunner: CommandRunner
  temporaryDirectoryCreator: (prefix: string) => string
  temporaryDirectoryRemover: (directoryPath: string) => void
}

interface CoveragePassed {
  status: "passed"
  filePath: string
  summary: FileCoverageSummary
}

interface CoverageFailed {
  status: "failed"
  filePath: string
  summary: FileCoverageSummary
  commandOutput: string
}

interface CoverageErrored {
  status: "errored"
  filePath: string
  message: string
  commandOutput: string
}

type CoverageFileResult = CoveragePassed | CoverageFailed | CoverageErrored

class CoverageUsageError extends Error {}

class CoverageSummaryReadError extends Error {}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return undefined
  }

  return trimmedValue
}

function normalizeMode(value: string | undefined): "files" | "pr-review" {
  const normalizedMode = normalizeOptionalText(value)

  if (!normalizedMode) {
    return "files"
  }

  if (normalizedMode === "pr-review") {
    return "pr-review"
  }

  if (normalizedMode === "files") {
    return "files"
  }

  throw new CoverageUsageError(`Expected coverage mode to be 'files' or 'pr-review'. Got ${normalizedMode}.`)
}

function isTypeScriptPath(filePath: string): boolean {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx")
}

function isExcludedTypeScriptPath(filePath: string): boolean {
  return (
    filePath.endsWith(".spec.ts")
    || filePath.endsWith(".spec.tsx")
    || filePath.endsWith(".test.ts")
    || filePath.endsWith(".test.tsx")
    || filePath.endsWith(".d.ts")
    || filePath.endsWith(".config.ts")
    || filePath.endsWith(".config.tsx")
    || filePath.includes("/fixtures/")
    || filePath.includes("/__fixtures__/")
  )
}

function isCoverableSourcePath(repositoryRoot: string, filePath: string): boolean {
  if (!isTypeScriptPath(filePath)) {
    return false
  }

  if (isExcludedTypeScriptPath(filePath)) {
    return false
  }

  const absoluteFilePath = path.resolve(repositoryRoot, filePath)
  return fs.existsSync(absoluteFilePath) && fs.statSync(absoluteFilePath).isFile()
}

function normalizeFileList(filePaths: string[] | undefined): string[] {
  if (!filePaths) {
    return []
  }

  return [...new Set(filePaths.map((filePath) => filePath.trim()).filter(Boolean))]
}

function resolveCoverageTargets(request: CoverageRequest, repositoryRoot: string, commandRunner: CommandRunner): string[] {
  const mode = normalizeMode(request.mode)

  if (mode === "pr-review") {
    return resolvePullRequestChangedFiles({
      repositoryRoot,
      pullRequest: request.pullRequest,
      base: request.base,
      head: request.head,
    }, commandRunner).filter((filePath) => isCoverableSourcePath(repositoryRoot, filePath))
  }

  return normalizeFileList(request.files).filter((filePath) => isCoverableSourcePath(repositoryRoot, filePath))
}

function findPackageRootFromDirectory(repositoryRoot: string, directoryPath: string): string {
  if (fs.existsSync(path.join(directoryPath, "package.json"))) {
    return directoryPath
  }

  if (directoryPath === repositoryRoot) {
    throw new CoverageUsageError(`Expected package.json ancestor for ${directoryPath}.`)
  }

  const parentDirectoryPath = path.dirname(directoryPath)

  if (parentDirectoryPath === directoryPath) {
    throw new CoverageUsageError(`Expected package.json ancestor for ${directoryPath}.`)
  }

  return findPackageRootFromDirectory(repositoryRoot, parentDirectoryPath)
}

function formatMissingVitestBinaryMessage(checkedBinaryPaths: string[]): string {
  return [
    "Expected Vitest binary in one of:",
    ...checkedBinaryPaths.map((binaryPath) => `- ${binaryPath}`),
  ].join("\n")
}

function resolveVitestBinaryFromDirectory(repositoryRoot: string, currentDirectory: string, checkedBinaryPaths: string[]): string {
  const binaryPath = path.join(currentDirectory, "node_modules", ".bin", "vitest")
  const nextCheckedBinaryPaths = [...checkedBinaryPaths, binaryPath]

  if (fs.existsSync(binaryPath)) {
    return binaryPath
  }

  if (currentDirectory === repositoryRoot) {
    throw new CoverageUsageError(formatMissingVitestBinaryMessage(nextCheckedBinaryPaths))
  }

  const parentDirectory = path.dirname(currentDirectory)

  if (parentDirectory === currentDirectory) {
    throw new CoverageUsageError(formatMissingVitestBinaryMessage(nextCheckedBinaryPaths))
  }

  return resolveVitestBinaryFromDirectory(repositoryRoot, parentDirectory, nextCheckedBinaryPaths)
}

function resolveVitestBinary(repositoryRoot: string, packageRoot: string): string {
  return resolveVitestBinaryFromDirectory(path.resolve(repositoryRoot), path.resolve(packageRoot), [])
}

function runCoverageCommand(
  repositoryRoot: string,
  packageRoot: string,
  packageRelativeFilePath: string,
  reportsDirectory: string,
  environment: CoverageExecutionEnvironment,
): CoverageCommandResult {
  const commandResult = environment.commandRunner.run(resolveVitestBinary(repositoryRoot, packageRoot), [
    "related",
    packageRelativeFilePath,
    "--run",
    "--coverage.enabled",
    `--coverage.include=${packageRelativeFilePath}`,
    "--coverage.reporter=json-summary",
    "--coverage.reporter=text",
    `--coverage.reportsDirectory=${reportsDirectory}`,
  ], packageRoot)

  const output = [commandResult.stdout, commandResult.stderr].filter(Boolean).join("\n").trim()

  return {
    status: commandResult.status,
    output,
    errorMessage: commandResult.errorMessage,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]

  if (typeof value === "number") {
    return value
  }

  throw new CoverageSummaryReadError(`Expected numeric coverage field '${key}'.`)
}

function readMetric(record: Record<string, unknown>, key: string): CoverageMetric {
  const value = record[key]

  if (!isRecord(value)) {
    throw new CoverageSummaryReadError(`Expected coverage metric '${key}'.`)
  }

  return {
    total: readNumber(value, "total"),
    covered: readNumber(value, "covered"),
    skipped: readNumber(value, "skipped"),
    pct: readNumber(value, "pct"),
  }
}

function readFileCoverageSummary(value: unknown): FileCoverageSummary {
  if (!isRecord(value)) {
    throw new CoverageSummaryReadError("Expected file coverage summary object.")
  }

  return {
    lines: readMetric(value, "lines"),
    statements: readMetric(value, "statements"),
    functions: readMetric(value, "functions"),
    branches: readMetric(value, "branches"),
  }
}

function normalizeCoverageKey(packageRoot: string, coverageKey: string): string {
  if (path.isAbsolute(coverageKey)) {
    return path.resolve(coverageKey)
  }

  return path.resolve(packageRoot, coverageKey)
}

function readCoverageSummary(packageRoot: string, reportsDirectory: string, packageRelativeFilePath: string): FileCoverageSummary {
  const summaryPath = path.join(reportsDirectory, "coverage-summary.json")

  if (!fs.existsSync(summaryPath)) {
    throw new CoverageSummaryReadError(`Expected coverage summary at ${summaryPath}.`)
  }

  const parsedSummary: unknown = JSON.parse(fs.readFileSync(summaryPath, "utf8"))

  if (!isRecord(parsedSummary)) {
    throw new CoverageSummaryReadError("Expected coverage summary JSON object.")
  }

  const expectedFilePath = path.resolve(packageRoot, packageRelativeFilePath)
  const matchingCoverageEntry = Object.entries(parsedSummary).find(([coverageKey]) => normalizeCoverageKey(packageRoot, coverageKey) === expectedFilePath)

  if (!matchingCoverageEntry) {
    throw new CoverageSummaryReadError(`Expected coverage summary row for ${packageRelativeFilePath}.`)
  }

  return readFileCoverageSummary(matchingCoverageEntry[1])
}

function hasCompleteCoverage(summary: FileCoverageSummary): boolean {
  return summary.statements.pct === 100
    && summary.branches.pct === 100
    && summary.functions.pct === 100
    && summary.lines.pct === 100
}

function formatCoverageErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return `Expected coverage error message. Got ${String(error)}.`
}

function executeCoverageWithReports(
  repositoryRoot: string,
  filePath: string,
  packageRoot: string,
  packageRelativeFilePath: string,
  environment: CoverageExecutionEnvironment,
): CoverageFileResult {
  const reportsDirectory = environment.temporaryDirectoryCreator(path.join(os.tmpdir(), "nt-skillz-coverage-"))

  try {
    const commandResult = runCoverageCommand(repositoryRoot, packageRoot, packageRelativeFilePath, reportsDirectory, environment)

    if (commandResult.errorMessage) {
      return {
        status: "errored",
        filePath,
        message: commandResult.errorMessage,
        commandOutput: commandResult.output,
      }
    }

    const summary = readCoverageSummary(packageRoot, reportsDirectory, packageRelativeFilePath)

    if (commandResult.status === 0 && hasCompleteCoverage(summary)) {
      return {
        status: "passed",
        filePath,
        summary,
      }
    }

    return {
      status: "failed",
      filePath,
      summary,
      commandOutput: commandResult.output,
    }
  } catch (error) {
    const message = formatCoverageErrorMessage(error)

    return {
      status: "errored",
      filePath,
      message,
      commandOutput: "",
    }
  } finally {
    environment.temporaryDirectoryRemover(reportsDirectory)
  }
}

function executeFileCoverage(repositoryRoot: string, filePath: string, environment: CoverageExecutionEnvironment): CoverageFileResult {
  try {
    const absoluteFilePath = path.resolve(repositoryRoot, filePath)
    const packageRoot = findPackageRootFromDirectory(repositoryRoot, path.dirname(absoluteFilePath))
    const packageRelativeFilePath = path.relative(packageRoot, absoluteFilePath)
    return executeCoverageWithReports(repositoryRoot, filePath, packageRoot, packageRelativeFilePath, environment)
  } catch (error) {
    const message = formatCoverageErrorMessage(error)

    return {
      status: "errored",
      filePath,
      message,
      commandOutput: "",
    }
  }
}

function formatPercent(metric: CoverageMetric): string {
  return `${metric.pct}%`
}

function formatCoverageRow(result: CoverageFileResult): string {
  if (result.status === "errored") {
    return `| \`${result.filePath}\` | error | error | error | error | ERROR |`
  }

  const status = result.status === "passed" ? "PASS" : "FAIL"

  return `| \`${result.filePath}\` | ${formatPercent(result.summary.statements)} | ${formatPercent(result.summary.branches)} | ${formatPercent(result.summary.functions)} | ${formatPercent(result.summary.lines)} | ${status} |`
}

function formatCoverageDetails(result: CoverageFileResult): string[] {
  if (result.status === "passed") {
    return []
  }

  const detailContent = result.status === "failed" ? result.commandOutput : [result.message, result.commandOutput].filter(Boolean).join("\n")

  if (!detailContent) {
    return []
  }

  return [
    `<details><summary>Coverage output for \`${result.filePath}\`</summary>`,
    "",
    "```text",
    detailContent,
    "```",
    "",
    "</details>",
  ]
}

function formatCoverageMarkdown(results: CoverageFileResult[]): string {
  if (results.length === 0) {
    return [
      "<!-- nt-skillz-coverage:start -->",
      "## Coverage",
      "",
      "No changed TypeScript source files.",
      "<!-- nt-skillz-coverage:end -->",
    ].join("\n")
  }

  const tableRows = results.map(formatCoverageRow)
  const detailRows = results.flatMap(formatCoverageDetails)
  const lines = [
    "<!-- nt-skillz-coverage:start -->",
    "## Coverage",
    "",
    "| File | Statements | Branches | Functions | Lines | Status |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...tableRows,
  ]

  if (detailRows.length > 0) {
    return [...lines, "", ...detailRows, "<!-- nt-skillz-coverage:end -->"].join("\n")
  }

  return [...lines, "<!-- nt-skillz-coverage:end -->"].join("\n")
}

export async function runVitestCoverageReview(
  request: CoverageRequest,
  environment: CoverageExecutionEnvironment = {
    commandRunner: childProcessCommandRunner,
    temporaryDirectoryCreator: fs.mkdtempSync,
    temporaryDirectoryRemover: (directoryPath) => fs.rmSync(directoryPath, {
      recursive: true,
      force: true,
    }),
  },
): Promise<{
  markdown: string
  results: CoverageFileResult[]
}> {
  const repositoryRoot = path.resolve(request.repositoryRoot ?? process.cwd())
  const coverageTargets = resolveCoverageTargets(request, repositoryRoot, environment.commandRunner)
  const results = coverageTargets.map((filePath) => executeFileCoverage(repositoryRoot, filePath, environment))

  return {
    markdown: formatCoverageMarkdown(results),
    results,
  }
}
