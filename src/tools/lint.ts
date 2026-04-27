import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

import { ESLint } from "eslint"
import { tool } from "@opencode-ai/plugin"

class UsageError extends Error {
  constructor(message: string) {
    super(message)
  }
}

class GitCommandError extends Error {
  constructor(message: string) {
    super(message)
  }
}

class MissingLocalDependencyError extends Error {
  constructor(message: string) {
    super(message)
  }
}

class LintExecutionError extends Error {
  constructor(message: string) {
    super(message)
  }
}

interface PortableLintRequest {
  repositoryRoot?: string
  files?: string[]
  base?: string
  head?: string
}

interface PortableLintOutcome {
  exitCode: number
  output: string
}

interface PortableLintCommandLine {
  repositoryRoot: string
  files: string[]
  base: string | undefined
  head: string | undefined
}

const toolDirectory = path.dirname(fileURLToPath(import.meta.url))
const toolRepositoryRoot = path.resolve(toolDirectory, "..", "..")
const eslintCliPath = path.join(toolRepositoryRoot, "node_modules", "eslint", "bin", "eslint.js")
const eslintConfigPath = path.join(toolRepositoryRoot, "scripts", "living-architecture-eslint.config.mjs")
const gitBinaryPath = "/usr/bin/git"

export const LINT_TOOL_NAME = "nt_skillz_lint"

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

function resolveDirectory(directoryPath: string): string {
  const absoluteDirectoryPath = path.resolve(directoryPath)

  if (!fs.existsSync(absoluteDirectoryPath)) {
    throw new UsageError(`Expected repository path to exist. Got ${absoluteDirectoryPath}.`)
  }

  if (!fs.statSync(absoluteDirectoryPath).isDirectory()) {
    throw new UsageError(`Expected repository path to be a directory. Got ${absoluteDirectoryPath}.`)
  }

  return absoluteDirectoryPath
}

function ensureSupportedFilePath(filePath: string): void {
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
    return
  }

  throw new UsageError(`Expected a TypeScript file path ending in .ts or .tsx. Got ${filePath}.`)
}

function normalizeFilePaths(filePaths: string[] | undefined): string[] {
  const normalizedFilePaths = (filePaths ?? []).map((filePath) => filePath.trim()).filter(Boolean)
  normalizedFilePaths.forEach(ensureSupportedFilePath)
  return normalizedFilePaths
}

function ensureLocalDependencies(): void {
  if (fs.existsSync(eslintCliPath)) {
    return
  }

  throw new MissingLocalDependencyError(
    `Expected ESLint dependencies to be installed in ${toolRepositoryRoot}.`,
  )
}

function runGitCommand(repositoryRoot: string, gitArguments: string[]): string {
  const gitResult = spawnSync(gitBinaryPath, ["-C", repositoryRoot, ...gitArguments], { encoding: "utf8" })

  if (gitResult.error) {
    throw new GitCommandError(`Expected git command to run. Got ${gitResult.error.message}.`)
  }

  if (gitResult.status === 0) {
    return gitResult.stdout
  }

  const errorOutput = gitResult.stderr.trim() || gitResult.stdout.trim() || "git command failed"
  throw new GitCommandError(`Expected git command to succeed. Got ${errorOutput}.`)
}

function readChangedTypeScriptFiles(repositoryRoot: string, baseReference: string, headReference: string): string[] {
  const diffRange = `${baseReference}...${headReference}`
  const output = runGitCommand(repositoryRoot, [
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    diffRange,
    "--",
    "*.ts",
    "*.tsx",
  ])

  return output.split("\n").filter(Boolean)
}

function readTrackedAndUntrackedTypeScriptFiles(repositoryRoot: string): string[] {
  const output = runGitCommand(repositoryRoot, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "*.ts",
    "*.tsx",
  ])

  return output.split("\n").filter(Boolean)
}

function ensureValidLintRequest(baseReference: string | undefined, headReference: string | undefined, filePaths: string[]): void {
  if (baseReference && filePaths.length > 0) {
    throw new UsageError("Expected either file paths or base reference. Got both.")
  }

  if (!baseReference && headReference) {
    throw new UsageError("Expected head reference to be used together with base reference.")
  }
}

function resolveLintTargets(repositoryRoot: string, baseReference: string | undefined, headReference: string | undefined, filePaths: string[]): string[] {
  if (filePaths.length > 0) {
    return filePaths
  }

  if (baseReference) {
    return readChangedTypeScriptFiles(repositoryRoot, baseReference, headReference ?? "HEAD")
  }

  return readTrackedAndUntrackedTypeScriptFiles(repositoryRoot)
}

function createLintTitle(filePaths: string[], baseReference: string | undefined): string {
  if (filePaths.length > 0) {
    return `Lint ${filePaths.length} TypeScript file(s)`
  }

  if (baseReference) {
    return `Lint TypeScript changes from ${baseReference}`
  }

  return "Lint current TypeScript files"
}

async function runEslint(repositoryRoot: string, lintTargets: string[]): Promise<PortableLintOutcome> {
  const previousLintRepositoryRoot = process.env.NT_SKILLZ_LINT_REPO_ROOT
  process.env.NT_SKILLZ_LINT_REPO_ROOT = repositoryRoot

  const eslint = new ESLint({
    cwd: repositoryRoot,
    errorOnUnmatchedPattern: false,
    overrideConfigFile: eslintConfigPath,
    warnIgnored: false,
  })

  try {
    const lintResults = await eslint.lintFiles(lintTargets)
    const formatter = await eslint.loadFormatter("stylish")
    const formattedOutput = (await formatter.format(lintResults)).trim()
    const errorCount = lintResults.reduce((count, lintResult) => count + lintResult.errorCount + lintResult.fatalErrorCount, 0)

    return {
      exitCode: errorCount > 0 ? 1 : 0,
      output: formattedOutput,
    }
  } finally {
    if (previousLintRepositoryRoot) {
      process.env.NT_SKILLZ_LINT_REPO_ROOT = previousLintRepositoryRoot
    } else {
      delete process.env.NT_SKILLZ_LINT_REPO_ROOT
    }
  }
}

function parsePortableLintCommandLine(commandLineArguments: string[]): PortableLintCommandLine {
  const parsedArguments = parseArgs({
    args: commandLineArguments,
    options: {
      repo: { type: "string" },
      base: { type: "string" },
      head: { type: "string" },
      help: {
        type: "boolean",
        short: "h",
      },
    },
    allowPositionals: true,
  })

  if (parsedArguments.values.help) {
    process.stdout.write([
      "Usage: ./scripts/lint-ts.sh [--repo PATH] [--base REF] [--head REF] [file ...]",
      "",
      "Examples:",
      "  ./scripts/lint-ts.sh --repo ../living-architecture --base origin/main",
      "  ./scripts/lint-ts.sh --repo ../living-architecture packages/example/src/example.ts",
      "  ./scripts/lint-ts.sh src/example.ts",
    ].join("\n") + "\n")
    process.exit(0)
  }

  return {
    repositoryRoot: resolveDirectory(parsedArguments.values.repo ?? process.cwd()),
    files: normalizeFilePaths(parsedArguments.positionals),
    base: normalizeOptionalText(parsedArguments.values.base),
    head: normalizeOptionalText(parsedArguments.values.head),
  }
}

export async function runPortableLint(request: PortableLintRequest): Promise<PortableLintOutcome> {
  ensureLocalDependencies()

  const repositoryRoot = resolveDirectory(request.repositoryRoot ?? process.cwd())
  const baseReference = normalizeOptionalText(request.base)
  const headReference = normalizeOptionalText(request.head)
  const filePaths = normalizeFilePaths(request.files)

  ensureValidLintRequest(baseReference, headReference, filePaths)

  const lintTargets = resolveLintTargets(repositoryRoot, baseReference, headReference, filePaths)

  if (lintTargets.length === 0) {
    return {
      exitCode: 0,
      output: "No TypeScript files matched.",
    }
  }

  return runEslint(repositoryRoot, lintTargets)
}

export async function runPortableLintFromCommandLine(commandLineArguments: string[]): Promise<number> {
  const request = parsePortableLintCommandLine(commandLineArguments)
  const outcome = await runPortableLint(request)

  if (outcome.output) {
    process.stdout.write(`${outcome.output}\n`)
  }

  return outcome.exitCode
}

export const lintTool = tool({
  description: "Run bundled TypeScript lint rules against current project files.",
  args: {
    files: tool.schema.array(tool.schema.string()).optional().describe("Relative .ts or .tsx file paths to lint."),
    base: tool.schema.string().optional().describe("Base git reference for PR-style changed-file linting."),
    head: tool.schema.string().optional().describe("Optional head git reference used with base."),
  },
  async execute(request, context) {
    const filePaths = normalizeFilePaths(request.files)
    const baseReference = normalizeOptionalText(request.base)
    const headReference = normalizeOptionalText(request.head)

    ensureValidLintRequest(baseReference, headReference, filePaths)
    context.metadata({ title: createLintTitle(filePaths, baseReference) })

    const outcome = await runPortableLint({
      repositoryRoot: context.worktree,
      files: filePaths,
      base: baseReference,
      head: headReference,
    })

    if (outcome.exitCode !== 0) {
      throw new LintExecutionError(outcome.output || "Lint failed.")
    }

    return {
      output: outcome.output || "Lint passed.",
      metadata: {
        base: baseReference ?? null,
        fileCount: filePaths.length,
        head: headReference ?? null,
      },
    }
  },
})
