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

  it("pushes branch when upstream is missing before creating pull request", () => {
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
      status: 1,
      stdout: "",
      stderr: "no upstream",
    }, {
      status: 0,
      stdout: "",
      stderr: "",
    }, {
      status: 0,
      stdout: "https://github.com/example/repo/pull/7\n",
      stderr: "",
    }], commandInvocations))

    expect(pullRequestUrl).toBe("https://github.com/example/repo/pull/7")
    expect(commandInvocations[4]).toStrictEqual({
      executable: "git",
      commandArguments: ["push", "-u", "origin", "feature/workflow-gates"],
      workingDirectory: "/repo",
    })
  })

  it("throws when required pull request text is empty", () => {
    const commandInvocations: CommandInvocation[] = []

    expect(() => createDraftPullRequest("/repo", {
      base: " ",
      title: "feat(gates): enforce OpenCode workflow gates",
      problem: "Agents can bypass the documented pull request workflow.",
      solution: "Pull request creation goes through a validating tool.",
      acceptanceCriteria: "Pull requests are created as drafts with required sections.",
      architectureAndSoftwareDesign: "The plugin exposes a guarded pull request creation tool.",
    }, createCommandRunner([], commandInvocations))).toThrow("Expected base to be provided. Got empty text.")
  })

  it("throws when working tree is not clean", () => {
    const commandInvocations: CommandInvocation[] = []

    expect(() => createDraftPullRequest("/repo", {
      base: "main",
      title: "feat(gates): enforce OpenCode workflow gates",
      problem: "Agents can bypass the documented pull request workflow.",
      solution: "Pull request creation goes through a validating tool.",
      acceptanceCriteria: "Pull requests are created as drafts with required sections.",
      architectureAndSoftwareDesign: "The plugin exposes a guarded pull request creation tool.",
    }, createCommandRunner([{
      status: 0,
      stdout: " M src/example.ts\n",
      stderr: "",
    }], commandInvocations))).toThrow("Expected working tree to be clean before pull request creation. Got M src/example.ts.")
  })

  it("throws when commit title is not semantic", () => {
    const commandInvocations: CommandInvocation[] = []

    expect(() => createDraftPullRequest("/repo", {
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
      stdout: "bad commit title\n",
      stderr: "",
    }], commandInvocations))).toThrow("Expected semantic commit title format <type>(<scope>): <short summary>. Got bad commit title.")
  })

  it("throws command run error when git command cannot execute", () => {
    const commandInvocations: CommandInvocation[] = []

    expect(() => createDraftPullRequest("/repo", {
      base: "main",
      title: "feat(gates): enforce OpenCode workflow gates",
      problem: "Agents can bypass the documented pull request workflow.",
      solution: "Pull request creation goes through a validating tool.",
      acceptanceCriteria: "Pull requests are created as drafts with required sections.",
      architectureAndSoftwareDesign: "The plugin exposes a guarded pull request creation tool.",
    }, createCommandRunner([{
      status: null,
      stdout: "",
      stderr: "",
      errorMessage: "spawn failed",
    }], commandInvocations))).toThrow("Expected working tree status check to run. Got spawn failed.")
  })

  it("throws command stderr when git command fails", () => {
    const commandInvocations: CommandInvocation[] = []

    expect(() => createDraftPullRequest("/repo", {
      base: "main",
      title: "feat(gates): enforce OpenCode workflow gates",
      problem: "Agents can bypass the documented pull request workflow.",
      solution: "Pull request creation goes through a validating tool.",
      acceptanceCriteria: "Pull requests are created as drafts with required sections.",
      architectureAndSoftwareDesign: "The plugin exposes a guarded pull request creation tool.",
    }, createCommandRunner([{
      status: 1,
      stdout: "",
      stderr: "fatal: git failed",
    }], commandInvocations))).toThrow("Expected working tree status check to succeed. Got fatal: git failed.")
  })

  it("throws command stdout when git command fails without stderr", () => {
    const commandInvocations: CommandInvocation[] = []

    expect(() => createDraftPullRequest("/repo", {
      base: "main",
      title: "feat(gates): enforce OpenCode workflow gates",
      problem: "Agents can bypass the documented pull request workflow.",
      solution: "Pull request creation goes through a validating tool.",
      acceptanceCriteria: "Pull requests are created as drafts with required sections.",
      architectureAndSoftwareDesign: "The plugin exposes a guarded pull request creation tool.",
    }, createCommandRunner([{
      status: 1,
      stdout: "git failed",
      stderr: "",
    }], commandInvocations))).toThrow("Expected working tree status check to succeed. Got git failed.")
  })

  it("throws command status when git command fails without output", () => {
    const commandInvocations: CommandInvocation[] = []

    expect(() => createDraftPullRequest("/repo", {
      base: "main",
      title: "feat(gates): enforce OpenCode workflow gates",
      problem: "Agents can bypass the documented pull request workflow.",
      solution: "Pull request creation goes through a validating tool.",
      acceptanceCriteria: "Pull requests are created as drafts with required sections.",
      architectureAndSoftwareDesign: "The plugin exposes a guarded pull request creation tool.",
    }, createCommandRunner([{
      status: 1,
      stdout: "",
      stderr: "",
    }], commandInvocations))).toThrow("Expected working tree status check to succeed. Got exit status 1.")
  })
})
