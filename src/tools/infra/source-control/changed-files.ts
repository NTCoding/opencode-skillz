import { spawnSync } from "node:child_process"

export interface CommandRunResult {
  status: number | null
  stdout: string
  stderr: string
  errorMessage?: string
}

export interface CommandRunner {
  run(executable: string, commandArguments: string[], workingDirectory: string): CommandRunResult
}

export interface PullRequestChangedFileRequest {
  repositoryRoot: string
  pullRequest?: string
  base?: string
  head?: string
}

export class PullRequestFileResolutionError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export const childProcessCommandRunner: CommandRunner = {
  run(executable: string, commandArguments: string[], workingDirectory: string): CommandRunResult {
    const commandResult = spawnSync(executable, commandArguments, {
      cwd: workingDirectory,
      encoding: "utf8",
    })

    if (commandResult.error) {
      return {
        status: commandResult.status,
        stdout: commandResult.stdout,
        stderr: commandResult.stderr,
        errorMessage: commandResult.error.message,
      }
    }

    return {
      status: commandResult.status,
      stdout: commandResult.stdout,
      stderr: commandResult.stderr,
    }
  },
}

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

function ensureSuccessfulCommand(commandResult: CommandRunResult, commandDescription: string): void {
  if (commandResult.errorMessage) {
    throw new PullRequestFileResolutionError(`Expected ${commandDescription} to run. Got ${commandResult.errorMessage}.`)
  }

  if (commandResult.status === 0) {
    return
  }

  const failureOutput = commandResult.stderr.trim() || commandResult.stdout.trim()

  if (failureOutput) {
    throw new PullRequestFileResolutionError(`Expected ${commandDescription} to succeed. Got ${failureOutput}.`)
  }

  throw new PullRequestFileResolutionError(`Expected ${commandDescription} to succeed. Got exit status ${commandResult.status}.`)
}

function splitChangedFileOutput(output: string): string[] {
  return [...new Set(output.split("\n").map((changedPath) => changedPath.trim()).filter(Boolean))]
}

function readGitHubPullRequestFiles(repositoryRoot: string, pullRequest: string, commandRunner: CommandRunner): string[] {
  const commandResult = commandRunner.run("gh", ["pr", "diff", pullRequest, "--name-only"], repositoryRoot)
  ensureSuccessfulCommand(commandResult, "GitHub pull request file discovery")
  return splitChangedFileOutput(commandResult.stdout)
}

function readGitChangedFiles(repositoryRoot: string, baseReference: string, headReference: string, commandRunner: CommandRunner): string[] {
  const commandResult = commandRunner.run("git", ["diff", "--name-only", "--diff-filter=ACMR", `${baseReference}...${headReference}`], repositoryRoot)
  ensureSuccessfulCommand(commandResult, "git changed-file discovery")
  return splitChangedFileOutput(commandResult.stdout)
}

export function resolvePullRequestChangedFiles(
  request: PullRequestChangedFileRequest,
  commandRunner: CommandRunner = childProcessCommandRunner,
): string[] {
  const pullRequest = normalizeOptionalText(request.pullRequest)

  if (pullRequest) {
    return readGitHubPullRequestFiles(request.repositoryRoot, pullRequest, commandRunner)
  }

  const baseReference = normalizeOptionalText(request.base)
  const headReference = normalizeOptionalText(request.head)

  if (baseReference && headReference) {
    return readGitChangedFiles(request.repositoryRoot, baseReference, headReference, commandRunner)
  }

  if (baseReference) {
    return readGitChangedFiles(request.repositoryRoot, baseReference, "HEAD", commandRunner)
  }

  throw new PullRequestFileResolutionError("Expected pull request identifier or base reference for pr-review mode.")
}
