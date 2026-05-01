import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"
import type { CommandRunner, CommandRunResult } from "../git-workflow-gates.js"
import { createPullRequestFeedbackTool } from "./pull-request-feedback-tool.js"

interface ToolContext {
  worktree: string
  metadata(metadata: Record<string, unknown>): void
}

interface CommandInvocation {
  executable: string
  commandArguments: string[]
  workingDirectory: string
}

class MissingCommandResultError extends Error {
  constructor(message: string) {
    super(message)
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

      throw new MissingCommandResultError(`Expected command result for ${executable}. Got none.`)
    },
  }
}

function createToolContext(repositoryRoot: string): ToolContext & { metadataCalls: Array<Record<string, unknown>> } {
  const metadataCalls: Array<Record<string, unknown>> = []

  return {
    metadataCalls,
    worktree: repositoryRoot,
    metadata(metadata: Record<string, unknown>): void {
      metadataCalls.push(metadata)
    },
  }
}

function createRepository(filePath: string, fileContent: string): string {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-tool-wrapper-"))
  const absoluteFilePath = path.join(repositoryRoot, filePath)
  fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true })
  fs.writeFileSync(absoluteFilePath, fileContent)
  return repositoryRoot
}

function removeRepository(repositoryRoot: string): void {
  fs.rmSync(repositoryRoot, {
    recursive: true,
    force: true,
  })
}

function successfulJson(jsonValue: unknown): CommandRunResult {
  return {
    status: 0,
    stdout: JSON.stringify(jsonValue),
    stderr: "",
  }
}

describe("createPullRequestFeedbackTool", () => {
  it("returns formatted feedback and records tool metadata", async () => {
    const repositoryRoot = createRepository("src/example.ts", "export const target = true\n")
    const toolContext = createToolContext(repositoryRoot)
    const commandInvocations: CommandInvocation[] = []
    const toolDefinition = createPullRequestFeedbackTool({
      commandRunner: createCommandRunner([
        successfulJson({
          baseRefName: "main",
          headRefName: "feature/pr-feedback",
          id: "PR_node_7",
          number: 7,
          url: "https://github.com/acme/widgets/pull/7",
        }),
        successfulJson({
          node: {
            reviewThreads: {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
              nodes: [],
            },
          },
        }),
      ], commandInvocations),
    })

    try {
      const result = await toolDefinition.execute({
        pullRequestNumber: "7",
        pullRequestUrl: "https://github.com/acme/widgets/pull/7",
      }, toolContext)

      expect(result).toStrictEqual({
        output: [
          "# Pull Request Feedback",
          "",
          "- PR number: 7",
          "- PR URL: https://github.com/acme/widgets/pull/7",
          "- Head branch: feature/pr-feedback",
          "- Base branch: main",
          "- Unresolved review threads: 0",
          "",
        ].join("\n"),
      })
      expect(toolContext.metadataCalls).toStrictEqual([{ title: "Fetch unresolved PR feedback" }])
    } finally {
      removeRepository(repositoryRoot)
    }
  })
})
