import { describe, expect, it } from "vitest"
import {
  childProcessCommandRunner,
  type CommandRunner,
  type CommandRunResult,
  PullRequestFileResolutionError,
  resolvePullRequestChangedFiles,
} from "./pull-request-files.js"

interface CommandInvocation {
  executable: string
  commandArguments: string[]
  workingDirectory: string
}

function createCommandRunner(commandResult: CommandRunResult, commandInvocations: CommandInvocation[]): CommandRunner {
  return {
    run(executable: string, commandArguments: string[], workingDirectory: string): CommandRunResult {
      commandInvocations.push({
        executable,
        commandArguments,
        workingDirectory,
      })

      return commandResult
    },
  }
}

describe("resolvePullRequestChangedFiles", () => {
  it("returns unique changed files when pull request identifier is provided", () => {
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner({
      status: 0,
      stdout: "src/one.ts\nsrc/two.ts\nsrc/one.ts\n",
      stderr: "",
    }, commandInvocations)

    const changedFiles = resolvePullRequestChangedFiles({
      repositoryRoot: "/repo",
      pullRequest: "12",
    }, commandRunner)

    expect(changedFiles).toStrictEqual(["src/one.ts", "src/two.ts"])
    expect(commandInvocations).toStrictEqual([{
      executable: "gh",
      commandArguments: ["pr", "diff", "12", "--name-only"],
      workingDirectory: "/repo",
    }])
  })

  it("returns changed files from git diff when base reference is provided", () => {
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner({
      status: 0,
      stdout: "src/changed.ts\n",
      stderr: "",
    }, commandInvocations)

    const changedFiles = resolvePullRequestChangedFiles({
      repositoryRoot: "/repo",
      base: "origin/main",
    }, commandRunner)

    expect(changedFiles).toStrictEqual(["src/changed.ts"])
    expect(commandInvocations[0]).toStrictEqual({
      executable: "git",
      commandArguments: ["diff", "--name-only", "--diff-filter=ACMR", "origin/main...HEAD"],
      workingDirectory: "/repo",
    })
  })

  it("throws resolution error when no pull request or base reference is provided", () => {
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner({
      status: 0,
      stdout: "",
      stderr: "",
    }, commandInvocations)

    expect(() => resolvePullRequestChangedFiles({ repositoryRoot: "/repo" }, commandRunner))
      .toThrow(PullRequestFileResolutionError)
  })

  it("throws resolution error when command exits unsuccessfully", () => {
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner({
      status: 1,
      stdout: "",
      stderr: "fatal: bad revision",
    }, commandInvocations)

    expect(() => resolvePullRequestChangedFiles({
      repositoryRoot: "/repo",
      base: "missing",
    }, commandRunner)).toThrow("Expected git changed-file discovery to succeed. Got fatal: bad revision.")
  })

  it("uses explicit head reference when base and head references are provided", () => {
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner({
      status: 0,
      stdout: "src/changed.ts\n",
      stderr: "",
    }, commandInvocations)

    resolvePullRequestChangedFiles({
      repositoryRoot: "/repo",
      base: "origin/main",
      head: "feature",
    }, commandRunner)

    expect(commandInvocations[0].commandArguments).toStrictEqual(["diff", "--name-only", "--diff-filter=ACMR", "origin/main...feature"])
  })

  it("ignores blank pull request identifier when base reference is provided", () => {
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner({
      status: 0,
      stdout: "src/changed.ts\n",
      stderr: "",
    }, commandInvocations)

    const changedFiles = resolvePullRequestChangedFiles({
      repositoryRoot: "/repo",
      pullRequest: "   ",
      base: "origin/main",
    }, commandRunner)

    expect(changedFiles).toStrictEqual(["src/changed.ts"])
  })

  it("throws run error when command runner returns execution error", () => {
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner({
      status: null,
      stdout: "",
      stderr: "",
      errorMessage: "spawn failed",
    }, commandInvocations)

    expect(() => resolvePullRequestChangedFiles({
      repositoryRoot: "/repo",
      pullRequest: "12",
    }, commandRunner)).toThrow("Expected GitHub pull request file discovery to run. Got spawn failed.")
  })

  it("throws exit status error when command runner has no failure output", () => {
    const commandInvocations: CommandInvocation[] = []
    const commandRunner = createCommandRunner({
      status: 2,
      stdout: "",
      stderr: "",
    }, commandInvocations)

    expect(() => resolvePullRequestChangedFiles({
      repositoryRoot: "/repo",
      pullRequest: "12",
    }, commandRunner)).toThrow("Expected GitHub pull request file discovery to succeed. Got exit status 2.")
  })
})

describe("childProcessCommandRunner", () => {
  it("returns stdout and status when child process command succeeds", () => {
    const commandResult = childProcessCommandRunner.run("/bin/echo", ["hello"], "/")

    expect(commandResult.status).toBe(0)
    expect(commandResult.stdout).toBe("hello\n")
  })

  it("returns error message when child process command cannot start", () => {
    const commandResult = childProcessCommandRunner.run("/missing-command-for-nt-skillz", [], "/")

    expect(commandResult.status).toBeNull()
    expect(commandResult.errorMessage).toBe("spawnSync /missing-command-for-nt-skillz ENOENT")
  })
})
