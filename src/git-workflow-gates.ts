export interface CommandRunResult {
  status: number | null
  stdout: string
  stderr: string
  errorMessage?: string
}

export interface CommandRunner {
  run(executable: string, commandArguments: string[], workingDirectory: string): CommandRunResult
}

export interface ToolExecutionInput {
  tool: string
}

export interface ToolExecutionOutput {
  args: Record<string, unknown>
}

export interface GitWorkflowGate {
  beforeToolExecution(input: ToolExecutionInput, output: ToolExecutionOutput): void
  recordLintedFiles(filePaths: string[]): void
}

export const directPullRequestCreationBlockedMessage = [
  "Direct gh pr create is banned for this workspace.",
  "Use nt_skillz_create_pr instead.",
].join("\n")

class GitWorkflowGateError extends Error {
  constructor(message: string) {
    super(message)
  }
}

function readBashCommandText(value: unknown): string {
  if (typeof value !== "string") {
    throw new GitWorkflowGateError(`Expected bash command text. Got ${String(value)}.`)
  }

  return value.trim()
}

function readCommandFailureMessage(commandResult: CommandRunResult): string {
  const stderr = commandResult.stderr.trim()
  if (stderr) {
    return stderr
  }

  const stdout = commandResult.stdout.trim()
  if (stdout) {
    return stdout
  }

  return `exit status ${commandResult.status}`
}

function isDirectPullRequestCreation(commandText: string): boolean {
  return /^gh\s+pr\s+create(?:\s|$)/.test(commandText)
}

function isGitCommit(commandText: string): boolean {
  return /^git\s+commit(?:\s|$)/.test(commandText)
}

function normalizeCommandOutput(commandResult: CommandRunResult, description: string): string {
  if (commandResult.errorMessage) {
    throw new GitWorkflowGateError(`Expected ${description} to run. Got ${commandResult.errorMessage}.`)
  }

  if (commandResult.status !== 0) {
    throw new GitWorkflowGateError(`Expected ${description} to succeed. Got ${readCommandFailureMessage(commandResult)}.`)
  }

  return commandResult.stdout.trim()
}

function isTypeScriptFilePath(filePath: string): boolean {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx")
}

function createUnlintedCommitMessage(filePaths: string[]): string {
  return [
    "Commit blocked: TypeScript files changed without nt_skillz_lint validation.",
    `Run nt_skillz_lint with files: ${JSON.stringify(filePaths)}`,
    "Then retry the commit.",
  ].join("\n")
}

export function createGitWorkflowGate(repositoryRoot: string, commandRunner: CommandRunner): GitWorkflowGate {
  const lintedFingerprints = new Map<string, string>()

  function runGit(commandArguments: string[], description: string): string {
    return normalizeCommandOutput(commandRunner.run("git", commandArguments, repositoryRoot), description)
  }

  function readWorkingTreeFingerprint(filePath: string): string {
    return runGit(["hash-object", "--", filePath], `working tree hash for ${filePath}`)
  }

  function readStagedFingerprint(filePath: string): string {
    return runGit(["rev-parse", `:${filePath}`], `staged hash for ${filePath}`)
  }

  function readStagedTypeScriptFilePaths(): string[] {
    const output = runGit([
      "diff",
      "--name-only",
      "--cached",
      "--diff-filter=ACMR",
      "--",
      "*.ts",
      "*.tsx",
    ], "staged TypeScript file discovery")

    return output.split("\n").map((filePath) => filePath.trim()).filter(Boolean)
  }

  function ensureStagedTypeScriptFilesAreLinted(): void {
    const stagedFilePaths = readStagedTypeScriptFilePaths()
    const unlintedFilePaths = stagedFilePaths.filter((filePath) => lintedFingerprints.get(filePath) !== readStagedFingerprint(filePath))

    if (unlintedFilePaths.length === 0) {
      return
    }

    throw new GitWorkflowGateError(createUnlintedCommitMessage(unlintedFilePaths))
  }

  return {
    beforeToolExecution(input: ToolExecutionInput, output: ToolExecutionOutput): void {
      if (input.tool !== "bash") {
        return
      }

      const commandText = readBashCommandText(output.args.command)

      if (isDirectPullRequestCreation(commandText)) {
        throw new GitWorkflowGateError(directPullRequestCreationBlockedMessage)
      }

      if (isGitCommit(commandText)) {
        ensureStagedTypeScriptFilesAreLinted()
      }
    },
    recordLintedFiles(filePaths: string[]): void {
      const typeScriptFilePaths = filePaths.filter(isTypeScriptFilePath)

      for (const filePath of typeScriptFilePaths) {
        lintedFingerprints.set(filePath, readWorkingTreeFingerprint(filePath))
      }
    },
  }
}
