import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"
import { readPullRequestFeedback } from "./feedback.js"
import type {
  CommandRunner,
  CommandRunResult,
} from "../source-control/changed-files.js"

function createRepository(filePath: string, fileContent: string): string {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-pr-feedback-formatting-"))
  fs.mkdirSync(path.dirname(path.join(repositoryRoot, filePath)), { recursive: true })
  fs.writeFileSync(path.join(repositoryRoot, filePath), fileContent)
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

function createCommandRunner(commandResults: CommandRunResult[]): CommandRunner {
  return {
    run(): CommandRunResult {
      const commandResult = commandResults.shift()
      if (commandResult) return commandResult

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

function createReviewThread(filePath: string, line: number | null) {
  return {
    id: filePath,
    isOutdated: false,
    isResolved: false,
    line,
    path: filePath,
    comments: {
      pageInfo: {
        hasNextPage: false,
      },
      nodes: [{
        author: {
          login: "reviewer",
        },
        body: `Review ${filePath}.`,
        createdAt: "2026-04-30T10:00:00Z",
        diffHunk: "@@ -1 +1 @@\n-review\n+review",
        url: `https://github.com/acme/widgets/pull/7#discussion_${filePath}`,
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

describe("readPullRequestFeedback formatting", () => {
  it("formats code excerpts for supported file extensions and null line numbers", () => {
    const repositoryRoot = createRepository("src/example.js", "const javascriptValue = true\n")
    const files = [
      ["src/example.jsx", "const jsxValue = true\n"],
      ["src/example.json", "{\"enabled\":true}\n"],
      ["src/example.md", "# Example\n"],
      ["src/example.yml", "enabled: true\n"],
      ["src/example.yaml", "enabled: true\n"],
      ["src/example.txt", "plain text\n"],
    ]
    for (const [filePath, content] of files) {
      fs.mkdirSync(path.dirname(path.join(repositoryRoot, filePath)), { recursive: true })
      fs.writeFileSync(path.join(repositoryRoot, filePath), content)
    }
    const reviewThreads = [
      "src/example.js",
      "src/example.jsx",
      "src/example.json",
      "src/example.md",
      "src/example.yml",
      "src/example.yaml",
      "src/example.txt",
    ].map((filePath) => createReviewThread(filePath, 1))
    reviewThreads.push(createReviewThread("src/example.js", null))
    const commandRunner = createCommandRunner([
      createSuccessfulCommandResult(createPullRequestView()),
      createSuccessfulCommandResult(createReviewThreadResponse(reviewThreads)),
    ])

    try {
      const feedback = readPullRequestFeedback({
        repositoryRoot,
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, { commandRunner })

      expect([
        feedback.includes("```js\n1: const javascriptValue = true"),
        feedback.includes("```json\n1: {\"enabled\":true}"),
        feedback.includes("```md\n1: # Example"),
        feedback.includes("```yaml\n1: enabled: true"),
        feedback.includes("```text\n1: plain text"),
        feedback.includes("No current line number returned by GitHub."),
      ]).toStrictEqual([true, true, true, true, true, true])
    } finally {
      removeRepository(repositoryRoot)
    }
  })
})
