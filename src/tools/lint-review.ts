import path from "node:path"
import process from "node:process"
import {
  type CommandRunner,
  resolvePullRequestChangedFiles,
} from "./pull-request-files.js"

export interface LintReviewRequest {
  repositoryRoot?: string
  pullRequest?: string
  base?: string
  head?: string
}

interface LintReviewEnvironment {
  commandRunner: CommandRunner
  lintRunner: (request: {
    repositoryRoot: string
    files: string[]
  }) => Promise<{
    exitCode: number
    output: string
  }>
}

function normalizeTypeScriptFiles(filePaths: string[]): string[] {
  return filePaths.filter((filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx"))
}

function formatLintMarkdown(output: string, fileCount: number, exitCode: number): string {
  if (fileCount === 0) {
    return [
      "<!-- nt-skillz-lint:start -->",
      "## Lint",
      "",
      "No changed TypeScript files.",
      "<!-- nt-skillz-lint:end -->",
    ].join("\n")
  }

  if (!output) {
    return [
      "<!-- nt-skillz-lint:start -->",
      "## Lint",
      "",
      `PASS: ${fileCount} changed TypeScript file(s).`,
      "<!-- nt-skillz-lint:end -->",
    ].join("\n")
  }

  const status = exitCode === 0 ? "PASS" : "FAIL"

  return [
    "<!-- nt-skillz-lint:start -->",
    "## Lint",
    "",
    `${status}: ${fileCount} changed TypeScript file(s).`,
    "",
    "```text",
    output,
    "```",
    "<!-- nt-skillz-lint:end -->",
  ].join("\n")
}

export async function runPrReviewLint(
  request: LintReviewRequest,
  environment: LintReviewEnvironment,
): Promise<string> {
  const repositoryRoot = path.resolve(request.repositoryRoot ?? process.cwd())
  const changedFiles = resolvePullRequestChangedFiles({
    repositoryRoot,
    pullRequest: request.pullRequest,
    base: request.base,
    head: request.head,
  }, environment.commandRunner)
  const typeScriptFiles = normalizeTypeScriptFiles(changedFiles)
  const outcome = await environment.lintRunner({
    repositoryRoot,
    files: typeScriptFiles,
  })

  return formatLintMarkdown(outcome.output, typeScriptFiles.length, outcome.exitCode)
}
