import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"
import { readPullRequestFeedback } from "./feedback.js"
import type {
  CommandRunner,
  CommandRunResult,
} from "../source-control/changed-files.js"

interface CommandInvocation {
  executable: string
  commandArguments: string[]
  workingDirectory: string
}

function createRepository(filePath: string, fileContent: string): string {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-pr-feedback-validation-"))
  const absoluteFilePath = path.join(repositoryRoot, filePath)

  fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true })
  fs.writeFileSync(absoluteFilePath, fileContent)

  return repositoryRoot
}

function removeRepository(repositoryRoot: string): void {
  fs.rmSync(repositoryRoot, {
    force: true,
    recursive: true,
  })
}

function createSuccessfulCommandResult(jsonValue: unknown): CommandRunResult {
  return {
    status: 0,
    stdout: JSON.stringify(jsonValue),
    stderr: "",
  }
}

function createCommandRunner(commandResults: CommandRunResult[], commandInvocations: CommandInvocation[]): CommandRunner {
  return {
    run(executable: string, commandArguments: string[], workingDirectory: string): CommandRunResult {
      commandInvocations.push({
        executable,
        commandArguments,
        workingDirectory,
      })

      const commandResult = commandResults.shift()

      if (commandResult) {
        return commandResult
      }

      return {
        status: 1,
        stdout: "",
        stderr: "Unexpected command invocation",
      }
    },
  }
}

function createPullRequestView() {
  return {
    baseRefName: "main",
    headRefName: "feature/pr-feedback",
    id: "PR_node_7",
    number: 7,
    url: "https://github.com/acme/widgets/pull/7",
  }
}

function createReviewThread(threadId: string, filePath: string) {
  return {
    id: threadId,
    isOutdated: false,
    isResolved: false,
    line: 1,
    path: filePath,
    comments: {
      pageInfo: {
        hasNextPage: false,
      },
      nodes: [{
        author: {
          login: "reviewer",
        },
        body: `Review ${threadId}.`,
        createdAt: "2026-04-30T10:00:00Z",
        diffHunk: "@@ -1 +1 @@\n-old\n+new",
        url: `https://github.com/acme/widgets/pull/7#discussion_${threadId}`,
      }],
    },
  }
}

function createReviewThreadResponse(reviewThreads: unknown[]) {
  return {
    node: {
      reviewThreads: {
        pageInfo: {
          endCursor: null,
          hasNextPage: false,
        },
        nodes: reviewThreads,
      },
    },
  }
}

function expectedReviewThreadsQuery(): string {
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

describe("readPullRequestFeedback validation", () => {
  it("runs exact GitHub lookup commands when fetching review threads", () => {
    const repositoryRoot = createRepository("src/example.ts", "export const target = true\n")
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
      createSuccessfulCommandResult(createReviewThreadResponse([
        createReviewThread("thread_unresolved", "src/example.ts"),
      ])),
    ], commandInvocations)

    try {
      readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, { commandRunner })

      expect(commandInvocations).toStrictEqual([{
        executable: "gh",
        commandArguments: ["pr", "view", "7", "--json", "id,number,url,headRefName,baseRefName", "--jq", "."],
        workingDirectory: repositoryRoot,
      }, {
        executable: "gh",
        commandArguments: ["api", "graphql", "-f", "pullRequestId=PR_node_7", "-f", `query=${expectedReviewThreadsQuery()}`],
        workingDirectory: repositoryRoot,
      }])
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("throws mismatch error when GitHub returns a different pull request URL", () => {
    const repositoryRoot = createRepository("src/example.ts", "export const target = true\n")
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
    ], commandInvocations)

    try {
      expect(() => readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/8",
      }, { commandRunner })).toThrow("Expected GitHub PR URL https://github.com/acme/widgets/pull/8. Got https://github.com/acme/widgets/pull/7.")
      expect(commandInvocations).toHaveLength(1)
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("throws user-facing JSON error when GitHub returns non-JSON stdout", () => {
    const commandRunner = createCommandRunner([{
      status: 0,
      stdout: "{not-json",
      stderr: "",
    }], [])

    expect(() => readPullRequestFeedback({
      repositoryRoot: "/repo",
      pullRequestNumber: "7",
      pullRequestUrl: "https://github.com/acme/widgets/pull/7",
    }, { commandRunner })).toThrow("Expected GitHub pull request lookup to return JSON. Got malformed JSON.")
  })

  it("throws path boundary error when review thread path escapes repository root", () => {
    const repositoryRoot = createRepository("src/example.ts", "export const target = true\n")
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
      createSuccessfulCommandResult(createReviewThreadResponse([
        createReviewThread("thread_escape", "../outside.ts"),
      ])),
    ], [])

    try {
      expect(() => readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, { commandRunner })).toThrow("Expected review thread path to stay inside repository root. Got ../outside.ts.")
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("throws path boundary error when review thread path is absolute", () => {
    const repositoryRoot = createRepository("src/example.ts", "export const target = true\n")
    const outsideFilePath = path.join(path.parse(repositoryRoot).root, "outside.ts")
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
      createSuccessfulCommandResult(createReviewThreadResponse([
        createReviewThread("thread_absolute", outsideFilePath),
      ])),
    ], [])

    try {
      expect(() => readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, { commandRunner })).toThrow(`Expected review thread path to stay inside repository root. Got ${outsideFilePath}.`)
    } finally {
      removeRepository(repositoryRoot)
    }
  })
})
