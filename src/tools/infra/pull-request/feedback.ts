import fs from "node:fs"
import path from "node:path"

import { z } from "zod"
import type {
  CommandRunner,
  CommandRunResult,
} from "../source-control/changed-files.js"
import { childProcessCommandRunner } from "../source-control/changed-files.js"

export const PULL_REQUEST_FEEDBACK_TOOL_NAME = "nt_skillz_pr_feedback"

const pullRequestViewSchema = z.object({
  baseRefName: z.string(),
  headRefName: z.string(),
  id: z.string().min(1),
  number: z.number().int(),
  url: z.string().min(1),
})

const reviewThreadSchema = z.object({
  id: z.string().min(1),
  isOutdated: z.boolean(),
  isResolved: z.boolean(),
  line: z.number().int().nullable(),
  path: z.string().min(1),
  comments: z.object({
    pageInfo: z.object({
      hasNextPage: z.boolean(),
    }),
    nodes: z.array(z.object({
      author: z.object({
        login: z.string().min(1),
      }),
      body: z.string(),
      createdAt: z.string().min(1),
      diffHunk: z.string(),
      url: z.string().min(1),
    })),
  }),
})

const reviewThreadsResponseSchema = z.object({
  node: z.object({
    reviewThreads: z.object({
      pageInfo: z.object({
        endCursor: z.string().nullable(),
        hasNextPage: z.boolean(),
      }),
      nodes: z.array(reviewThreadSchema),
    }),
  }),
})

type PullRequestView = z.infer<typeof pullRequestViewSchema>
type ReviewThread = z.infer<typeof reviewThreadSchema>

export class PullRequestFeedbackError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export interface PullRequestFeedbackRequest {
  repositoryRoot: string
  pullRequestNumber: string
  pullRequestUrl: string
}

export interface PullRequestFeedbackDependencies {
  commandRunner?: CommandRunner
}

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalizedValue = value.trim()

  if (normalizedValue) {
    return normalizedValue
  }

  throw new PullRequestFeedbackError(`Expected ${fieldName} to be non-empty. Got blank text.`)
}

function ensureSuccessfulCommand(commandResult: CommandRunResult, commandDescription: string): void {
  if (commandResult.errorMessage) {
    throw new PullRequestFeedbackError(`Expected ${commandDescription} to run. Got ${commandResult.errorMessage}.`)
  }

  if (commandResult.status === 0) {
    return
  }

  const failureOutput = commandResult.stderr.trim() || commandResult.stdout.trim()

  if (failureOutput) {
    throw new PullRequestFeedbackError(`Expected ${commandDescription} to succeed. Got ${failureOutput}.`)
  }

  throw new PullRequestFeedbackError(`Expected ${commandDescription} to succeed. Got exit status ${commandResult.status}.`)
}

function parseJsonWithSchema<T>(jsonText: string, schema: z.ZodType<T>, commandDescription: string): T {
  const parsedJson: unknown = JSON.parse(jsonText)
  const parsedResult = schema.safeParse(parsedJson)

  if (parsedResult.success) {
    return parsedResult.data
  }

  throw new PullRequestFeedbackError(`Expected ${commandDescription} to return valid JSON. Got ${parsedResult.error.message}.`)
}

function readPullRequestView(
  repositoryRoot: string,
  pullRequestNumber: string,
  commandRunner: CommandRunner,
): PullRequestView {
  const commandResult = commandRunner.run("gh", [
    "pr",
    "view",
    pullRequestNumber,
    "--json",
    "id,number,url,headRefName,baseRefName",
    "--jq",
    ".",
  ], repositoryRoot)

  ensureSuccessfulCommand(commandResult, "GitHub pull request lookup")
  return parseJsonWithSchema(commandResult.stdout, pullRequestViewSchema, "GitHub pull request lookup")
}

function createReviewThreadsQuery(): string {
  return [
    "query($pullRequestId: ID!, $threadCursor: String) {",
    "  node(id: $pullRequestId) {",
    "    ... on PullRequest {",
    "      reviewThreads(first: 100, after: $threadCursor) {",
    "        pageInfo { endCursor hasNextPage }",
    "        nodes {",
    "          id",
    "          isOutdated",
    "          isResolved",
    "          line",
    "          path",
    "          comments(first: 100) {",
    "            pageInfo { hasNextPage }",
    "            nodes {",
    "              author { login }",
    "              body",
    "              createdAt",
    "              diffHunk",
    "              url",
    "            }",
    "          }",
    "        }",
    "      }",
    "    }",
    "  }",
    "}",
  ].join("\n")
}

function readReviewThreadPage(
  repositoryRoot: string,
  pullRequestId: string,
  threadCursor: string | null,
  commandRunner: CommandRunner,
): z.infer<typeof reviewThreadsResponseSchema> {
  const commandArguments = [
    "api",
    "graphql",
    "-f",
    `pullRequestId=${pullRequestId}`,
    "-f",
    `query=${createReviewThreadsQuery()}`,
  ]

  if (threadCursor) {
    commandArguments.splice(4, 0, "-f", `threadCursor=${threadCursor}`)
  }

  const commandResult = commandRunner.run("gh", commandArguments, repositoryRoot)

  ensureSuccessfulCommand(commandResult, "GitHub pull request review thread lookup")
  return parseJsonWithSchema(commandResult.stdout, reviewThreadsResponseSchema, "GitHub pull request review thread lookup")
}

function readAllReviewThreads(
  repositoryRoot: string,
  pullRequestId: string,
  commandRunner: CommandRunner,
  threadCursor: string | null = null,
  previousReviewThreads: ReviewThread[] = [],
): ReviewThread[] {
  const response = readReviewThreadPage(repositoryRoot, pullRequestId, threadCursor, commandRunner)
  const reviewThreadPage = response.node.reviewThreads
  const reviewThreads = [...previousReviewThreads, ...reviewThreadPage.nodes]

  if (reviewThreadPage.pageInfo.hasNextPage) {
    if (reviewThreadPage.pageInfo.endCursor === null) {
      throw new PullRequestFeedbackError("Expected GitHub review thread page cursor. Got null.")
    }

    return readAllReviewThreads(
      repositoryRoot,
      pullRequestId,
      commandRunner,
      reviewThreadPage.pageInfo.endCursor,
      reviewThreads,
    )
  }

  return reviewThreads
}

function ensurePullRequestMatchesRequest(
  pullRequestView: PullRequestView,
  pullRequestNumber: string,
  pullRequestUrl: string,
): void {
  if (String(pullRequestView.number) !== pullRequestNumber) {
    throw new PullRequestFeedbackError(
      `Expected GitHub PR number ${pullRequestNumber}. Got ${pullRequestView.number}.`,
    )
  }

  if (pullRequestView.url !== pullRequestUrl) {
    throw new PullRequestFeedbackError(
      `Expected GitHub PR URL ${pullRequestUrl}. Got ${pullRequestView.url}.`,
    )
  }
}

function ensureCompleteThreadComments(reviewThreads: ReviewThread[]): void {
  const incompleteThread = reviewThreads.find((reviewThread) => reviewThread.comments.pageInfo.hasNextPage)

  if (!incompleteThread) {
    return
  }

  throw new PullRequestFeedbackError(
    `Expected review thread ${incompleteThread.id} to have at most 100 comments. Got more than 100 comments.`,
  )
}

function languageForPath(filePath: string): string {
  const extension = path.extname(filePath)

  if (extension === ".ts" || extension === ".tsx") return "ts"
  if (extension === ".js" || extension === ".jsx") return "js"
  if (extension === ".json") return "json"
  if (extension === ".md") return "md"
  if (extension === ".yml" || extension === ".yaml") return "yaml"

  return "text"
}

function quoteMarkdown(value: string): string {
  return value.split("\n").map((line) => `> ${line}`).join("\n")
}

function formatDiffHunk(diffHunk: string): string {
  if (diffHunk.trim()) {
    return ["```diff", diffHunk, "```"].join("\n")
  }

  return "No diff hunk returned by GitHub."
}

function readCodeExcerpt(repositoryRoot: string, filePath: string, lineNumber: number | null): string {
  const absoluteFilePath = path.join(repositoryRoot, filePath)

  if (!fs.existsSync(absoluteFilePath)) {
    return `Current local file not found: ${filePath}`
  }

  if (lineNumber === null) {
    return "No current line number returned by GitHub."
  }

  const fileLines = fs.readFileSync(absoluteFilePath, "utf8").split("\n")
  const startLine = Math.max(1, lineNumber - 5)
  const endLine = Math.min(fileLines.length, lineNumber + 5)
  const excerptLines = fileLines.slice(startLine - 1, endLine)
  const numberedLines = excerptLines.map((line, index) => `${startLine + index}: ${line}`)

  return [`\`\`\`${languageForPath(filePath)}`, ...numberedLines, "```"].join("\n")
}

function formatComments(reviewThread: ReviewThread): string {
  return reviewThread.comments.nodes.map((comment, index) => [
    `#### Comment ${index + 1}`,
    `- Comment URL: ${comment.url}`,
    `- Author: ${comment.author.login}`,
    `- Created: ${comment.createdAt}`,
    "- Full comment:",
    quoteMarkdown(comment.body),
  ].join("\n")).join("\n\n")
}

function readLatestDiffHunk(reviewThread: ReviewThread): string {
  const latestComment = reviewThread.comments.nodes.at(-1)

  if (latestComment) {
    return latestComment.diffHunk
  }

  throw new PullRequestFeedbackError(`Expected review thread ${reviewThread.id} to contain at least one comment. Got 0.`)
}

function formatReviewLine(lineNumber: number | null): string {
  if (lineNumber === null) {
    return "outdated"
  }

  return String(lineNumber)
}

function formatReviewThread(repositoryRoot: string, reviewThread: ReviewThread): string {
  return [
    `## Thread ${reviewThread.id}`,
    "",
    "### Reviewer feedback",
    formatComments(reviewThread),
    "",
    "### Review context",
    `- File: ${reviewThread.path}`,
    `- Line: ${formatReviewLine(reviewThread.line)}`,
    `- Outdated: ${reviewThread.isOutdated ? "yes" : "no"}`,
    "- Diff hunk:",
    formatDiffHunk(readLatestDiffHunk(reviewThread)),
    "",
    "### Current local code",
    readCodeExcerpt(repositoryRoot, reviewThread.path, reviewThread.line),
  ].join("\n")
}

export function readPullRequestFeedback(
  request: PullRequestFeedbackRequest,
  dependencies: PullRequestFeedbackDependencies = {},
): string {
  const pullRequestNumber = normalizeRequiredText(request.pullRequestNumber, "pull request number")
  const pullRequestUrl = normalizeRequiredText(request.pullRequestUrl, "pull request URL")
  const commandRunner = dependencies.commandRunner ?? childProcessCommandRunner
  const pullRequestView = readPullRequestView(request.repositoryRoot, pullRequestNumber, commandRunner)

  ensurePullRequestMatchesRequest(pullRequestView, pullRequestNumber, pullRequestUrl)

  const reviewThreads = readAllReviewThreads(request.repositoryRoot, pullRequestView.id, commandRunner)
  ensureCompleteThreadComments(reviewThreads)

  const unresolvedReviewThreads = reviewThreads.filter((reviewThread) => !reviewThread.isResolved)

  return [
    "# Pull Request Feedback",
    "",
    `- PR number: ${pullRequestView.number}`,
    `- PR URL: ${pullRequestView.url}`,
    `- Head branch: ${pullRequestView.headRefName}`,
    `- Base branch: ${pullRequestView.baseRefName}`,
    `- Unresolved review threads: ${unresolvedReviewThreads.length}`,
    "",
    ...unresolvedReviewThreads.map((reviewThread) => formatReviewThread(request.repositoryRoot, reviewThread)),
  ].join("\n")
}
