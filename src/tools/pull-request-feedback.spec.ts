import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"
import {
  PullRequestFeedbackError,
  readPullRequestFeedback,
} from "./pull-request-feedback.js"
import type {
  CommandRunner,
  CommandRunResult,
} from "./pull-request-files.js"

interface CommandInvocation {
  executable: string
  commandArguments: string[]
  workingDirectory: string
}

function createRepository(filePath: string, fileContent: string): string {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-pr-feedback-"))
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

function createReviewThread(threadId: string, isResolved: boolean, commentHasNextPage = false) {
  return {
    id: threadId,
    isOutdated: false,
    isResolved,
    line: 4,
    path: "src/example.ts",
    comments: {
      pageInfo: {
        hasNextPage: commentHasNextPage,
      },
      nodes: [{
        author: {
          login: "reviewer",
        },
        body: `Please rename this exported value from ${threadId}.`,
        createdAt: "2026-04-30T10:00:00Z",
        diffHunk: "@@ -1,4 +1,4 @@\n-export const oldName = true\n+export const target = true",
        url: `https://github.com/acme/widgets/pull/7#discussion_${threadId}`,
      }],
    },
  }
}

function createReviewThreadResponse(reviewThreads: unknown[], hasNextPage: boolean, endCursor: string | null) {
  return {
    node: {
      reviewThreads: {
        pageInfo: {
          endCursor,
          hasNextPage,
        },
        nodes: reviewThreads,
      },
    },
  }
}

describe("readPullRequestFeedback", () => {
  it("filters resolved threads when GitHub returns mixed thread states", () => {
    const repositoryRoot = createRepository("src/example.ts", [
      "export const first = true",
      "export const second = true",
      "export const third = true",
      "export const target = true",
      "export const fifth = true",
      "export const sixth = true",
      "export const seventh = true",
    ].join("\n"))
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
      createSuccessfulCommandResult(createReviewThreadResponse([
        createReviewThread("thread_unresolved", false),
        createReviewThread("thread_resolved", true),
      ], false, null)),
    ], commandInvocations)

    try {
      const feedback = readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, { commandRunner })

      expect(feedback).toContain("- Unresolved review threads: 1")
      expect(feedback).toContain("## Thread thread_unresolved")
      expect(feedback).not.toContain("## Thread thread_resolved")
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("returns reviewer evidence when a thread is unresolved", () => {
    const repositoryRoot = createRepository("src/example.ts", [
      "export const first = true",
      "export const second = true",
      "export const third = true",
      "export const target = true",
      "export const fifth = true",
    ].join("\n"))
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
      createSuccessfulCommandResult(createReviewThreadResponse([
        createReviewThread("thread_unresolved", false),
      ], false, null)),
    ], [])

    try {
      const feedback = readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, { commandRunner })

      expect(feedback).toContain("Please rename this exported value from thread_unresolved.")
      expect(feedback).toContain("```diff\n@@ -1,4 +1,4 @@\n-export const oldName = true\n+export const target = true\n```")
      expect(feedback).toContain("4: export const target = true")
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("runs exact GitHub lookup commands when fetching review threads", () => {
    const repositoryRoot = createRepository("src/example.ts", "export const target = true\n")
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
      createSuccessfulCommandResult(createReviewThreadResponse([
        createReviewThread("thread_unresolved", false),
      ], false, null)),
    ], commandInvocations)

    try {
      readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, { commandRunner })

      expect(commandInvocations[0]).toStrictEqual({
        executable: "gh",
        commandArguments: [
          "pr",
          "view",
          "7",
          "--json",
          "id,number,url,headRefName,baseRefName",
          "--jq",
          ".",
        ],
        workingDirectory: repositoryRoot,
      })
      expect(commandInvocations[1].commandArguments.slice(0, 4)).toStrictEqual([
        "api",
        "graphql",
        "-f",
        "pullRequestId=PR_node_7",
      ])
      expect(commandInvocations[1].commandArguments.join("\n")).toContain("reviewThreads(first: 100, after: $threadCursor)")
      expect(commandInvocations[1].commandArguments.join("\n")).toContain("comments(first: 100)")
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("fetches the next review thread page when GitHub returns a thread cursor", () => {
    const repositoryRoot = createRepository("src/example.ts", "export const target = true\n")
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
      createSuccessfulCommandResult(createReviewThreadResponse([], true, "cursor_1")),
      createSuccessfulCommandResult(createReviewThreadResponse([createReviewThread("thread_second_page", false)], false, null)),
    ], commandInvocations)

    try {
      const feedback = readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, { commandRunner })

      expect(feedback).toContain("## Thread thread_second_page")
      expect(commandInvocations[2].commandArguments).toContain("threadCursor=cursor_1")
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
      }, { commandRunner })).toThrow(PullRequestFeedbackError)
      expect(commandInvocations).toHaveLength(1)
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("throws truncation error when a review thread has more than one hundred comments", () => {
    const repositoryRoot = createRepository("src/example.ts", "export const target = true\n")
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
      createSuccessfulCommandResult(createReviewThreadResponse([
        createReviewThread("thread_with_many_comments", false, true),
      ], false, null)),
    ], [])

    try {
      expect(() => readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, { commandRunner })).toThrow("Expected review thread thread_with_many_comments to have at most 100 comments. Got more than 100 comments.")
    } finally {
      removeRepository(repositoryRoot)
    }
  })
})
