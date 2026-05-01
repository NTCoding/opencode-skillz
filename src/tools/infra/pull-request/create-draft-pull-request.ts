import type {
  CommandRunner,
  CommandRunResult,
} from "../../../git-workflow-gates.js"

export const CREATE_PULL_REQUEST_TOOL_NAME = "nt_skillz_create_pr"

export interface CreatePullRequestRequest {
  base: string
  title: string
  problem: string
  solution: string
  acceptanceCriteria: string
  architectureAndSoftwareDesign: string
}

const semanticCommitTitlePattern = /^(feat|fix|refactor|perf|docs|test|build|ci|release|chore)\([^)]+\): .+/

class CreatePullRequestError extends Error {
  constructor(message: string) {
    super(message)
  }
}

function normalizeRequiredText(value: string, fieldName: string): string {
  const trimmedValue = value.trim()

  if (trimmedValue) {
    return trimmedValue
  }

  throw new CreatePullRequestError(`Expected ${fieldName} to be provided. Got empty text.`)
}

function runCommand(repositoryRoot: string, commandRunner: CommandRunner, executable: string, commandArguments: string[], description: string): string {
  const commandResult = commandRunner.run(executable, commandArguments, repositoryRoot)

  if (commandResult.errorMessage) {
    throw new CreatePullRequestError(`Expected ${description} to run. Got ${commandResult.errorMessage}.`)
  }

  if (commandResult.status !== 0) {
    throw new CreatePullRequestError(`Expected ${description} to succeed. Got ${readCommandFailureMessage(commandResult)}.`)
  }

  return commandResult.stdout.trim()
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

function validateCleanWorkingTree(repositoryRoot: string, commandRunner: CommandRunner): void {
  const statusOutput = runCommand(repositoryRoot, commandRunner, "git", ["status", "--porcelain"], "working tree status check")

  if (!statusOutput) {
    return
  }

  throw new CreatePullRequestError(`Expected working tree to be clean before pull request creation. Got ${statusOutput}.`)
}

function validateSemanticCommitTitles(repositoryRoot: string, commandRunner: CommandRunner, base: string): void {
  const commitTitleOutput = runCommand(repositoryRoot, commandRunner, "git", ["log", "--format=%s", `${base}..HEAD`], "pull request commit title discovery")
  const commitTitles = commitTitleOutput.split("\n").map((commitTitle) => commitTitle.trim()).filter(Boolean)
  const invalidCommitTitle = commitTitles.find((commitTitle) => !semanticCommitTitlePattern.test(commitTitle))

  if (!invalidCommitTitle) {
    return
  }

  throw new CreatePullRequestError(`Expected semantic commit title format <type>(<scope>): <short summary>. Got ${invalidCommitTitle}.`)
}

function readCurrentBranch(repositoryRoot: string, commandRunner: CommandRunner): string {
  return runCommand(repositoryRoot, commandRunner, "git", ["branch", "--show-current"], "current branch discovery")
}

function pushBranchWhenUpstreamIsMissing(repositoryRoot: string, commandRunner: CommandRunner, branchName: string): void {
  const upstreamResult = commandRunner.run("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repositoryRoot)

  if (upstreamResult.status === 0) {
    return
  }

  runCommand(repositoryRoot, commandRunner, "git", ["push", "-u", "origin", branchName], "branch push")
}

function createPullRequestBody(request: CreatePullRequestRequest): string {
  return [
    "## Problem",
    normalizeRequiredText(request.problem, "problem"),
    "",
    "## Solution",
    normalizeRequiredText(request.solution, "solution"),
    "",
    "## Acceptance Criteria",
    normalizeRequiredText(request.acceptanceCriteria, "acceptanceCriteria"),
    "",
    "## Architecture and software design",
    normalizeRequiredText(request.architectureAndSoftwareDesign, "architectureAndSoftwareDesign"),
  ].join("\n")
}

export function createDraftPullRequest(repositoryRoot: string, request: CreatePullRequestRequest, commandRunner: CommandRunner): string {
  const base = normalizeRequiredText(request.base, "base")
  const title = normalizeRequiredText(request.title, "title")
  const body = createPullRequestBody(request)

  validateCleanWorkingTree(repositoryRoot, commandRunner)
  validateSemanticCommitTitles(repositoryRoot, commandRunner, base)

  const branchName = readCurrentBranch(repositoryRoot, commandRunner)
  pushBranchWhenUpstreamIsMissing(repositoryRoot, commandRunner, branchName)

  return runCommand(repositoryRoot, commandRunner, "gh", [
    "pr",
    "create",
    "--draft",
    "--base",
    base,
    "--title",
    title,
    "--body",
    body,
  ], "draft pull request creation")
}
