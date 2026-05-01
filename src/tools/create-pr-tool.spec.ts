import { describe, expect, it } from "vitest"
import type { CommandRunner, CommandRunResult } from "../git-workflow-gates.js"
import { createPullRequestToolWithRunner } from "./create-pr-tool.js"

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

interface ToolContext {
  worktree: string
  metadata(metadata: Record<string, unknown>): void
}

function createToolContext(repositoryRoot: string): ToolContext {
  return {
    worktree: repositoryRoot,
    metadata(): void {},
  }
}

describe("createPullRequestToolWithRunner", () => {
  it("returns pull request URL when draft pull request is created", async () => {
    const commandInvocations: CommandInvocation[] = []
    const toolDefinition = createPullRequestToolWithRunner(createCommandRunner([{
      status: 0,
      stdout: "",
      stderr: "",
    }, {
      status: 0,
      stdout: "feat(gates): enforce OpenCode workflow gates\n",
      stderr: "",
    }, {
      status: 0,
      stdout: "feature/workflow-gates\n",
      stderr: "",
    }, {
      status: 0,
      stdout: "origin/feature/workflow-gates\n",
      stderr: "",
    }, {
      status: 0,
      stdout: "https://github.com/example/repo/pull/7\n",
      stderr: "",
    }], commandInvocations))

    const result = await toolDefinition.execute({
      base: "main",
      title: "feat(gates): enforce OpenCode workflow gates",
      problem: "Agents can bypass the documented pull request workflow.",
      solution: "Pull request creation goes through a validating tool.",
      acceptanceCriteria: "Pull requests are created as drafts with required sections.",
      architectureAndSoftwareDesign: "The plugin exposes a guarded pull request creation tool.",
    }, createToolContext("/repo"))

    expect(result).toStrictEqual({
      output: "https://github.com/example/repo/pull/7",
    })
  })
})
