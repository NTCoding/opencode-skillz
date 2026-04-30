import { describe, expect, it } from "vitest"
import type {
  CommandRunner,
  CommandRunResult,
} from "../git-workflow-gates.js"
import { createDraftPullRequest } from "./create-pr.js"

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

      if (!commandResult) {
        throw new MissingCommandResultError(`Expected command result for ${executable} ${commandArguments.join(" ")}. Got none.`)
      }

      return commandResult
    },
  }
}

describe("createDraftPullRequest", () => {
  it("creates draft pull request with required body sections when branch is ready", () => {
    const commandInvocations: CommandInvocation[] = []
    const pullRequestUrl = createDraftPullRequest("/repo", {
      base: "main",
      title: "feat(gates): enforce OpenCode workflow gates",
      problem: "Agents can bypass the documented pull request workflow.",
      solution: "Pull request creation goes through a validating tool.",
      acceptanceCriteria: "Pull requests are created as drafts with required sections.",
      architectureAndSoftwareDesign: "The plugin exposes a guarded pull request creation tool.",
    }, createCommandRunner([{
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

    expect(pullRequestUrl).toBe("https://github.com/example/repo/pull/7")
    expect(commandInvocations.at(-1)).toStrictEqual({
      executable: "gh",
      commandArguments: [
        "pr",
        "create",
        "--draft",
        "--base",
        "main",
        "--title",
        "feat(gates): enforce OpenCode workflow gates",
        "--body",
        [
          "## Problem",
          "Agents can bypass the documented pull request workflow.",
          "",
          "## Solution",
          "Pull request creation goes through a validating tool.",
          "",
          "## Acceptance Criteria",
          "Pull requests are created as drafts with required sections.",
          "",
          "## Architecture and software design",
          "The plugin exposes a guarded pull request creation tool.",
        ].join("\n"),
      ],
      workingDirectory: "/repo",
    })
  })
})
