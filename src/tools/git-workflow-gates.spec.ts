import { describe, expect, it } from "vitest"
import {
  createGitWorkflowGate,
  type CommandRunner,
  type CommandRunResult,
} from "../git-workflow-gates.js"

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

describe("createGitWorkflowGate", () => {
  it("blocks direct pull request creation when gh pr create is invoked", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([], commandInvocations))

    expect(() => gate.beforeToolExecution({
      tool: "bash",
    }, {
      args: {
        command: "gh pr create --draft",
      },
    })).toThrow([
      "Direct gh pr create is banned for this workspace.",
      "Use nt_skillz_create_pr instead.",
    ].join("\n"))
  })

  it("blocks commit when staged TypeScript content has not been linted", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([{
      status: 0,
      stdout: "src/example.ts\n",
      stderr: "",
    }, {
      status: 0,
      stdout: "typescript-blob-hash\n",
      stderr: "",
    }], commandInvocations))

    expect(() => gate.beforeToolExecution({
      tool: "bash",
    }, {
      args: {
        command: "git commit -m 'feat(example): add example'",
      },
    })).toThrow([
      "Commit blocked: TypeScript files changed without nt_skillz_lint validation.",
      "Run nt_skillz_lint with files: [\"src/example.ts\"]",
      "Then retry the commit.",
    ].join("\n"))
  })

  it("allows commit when staged TypeScript content matches linted content", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([{
      status: 0,
      stdout: "typescript-blob-hash\n",
      stderr: "",
    }, {
      status: 0,
      stdout: "src/example.ts\n",
      stderr: "",
    }, {
      status: 0,
      stdout: "typescript-blob-hash\n",
      stderr: "",
    }], commandInvocations))

    gate.recordLintedFiles(["src/example.ts"])

    expect(() => gate.beforeToolExecution({
      tool: "bash",
    }, {
      args: {
        command: "git commit -m 'feat(example): add example'",
      },
    })).not.toThrow()
  })
})
