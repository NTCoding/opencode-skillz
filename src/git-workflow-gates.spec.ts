import { describe, expect, it } from "vitest"
import {
  createGitWorkflowGate,
  type CommandRunner,
  type CommandRunResult,
} from "./git-workflow-gates.js"

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

  it("blocks direct pull request creation when command sequence invokes gh pr create", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([], commandInvocations))

    expect(() => gate.beforeToolExecution({
      tool: "bash",
    }, {
      args: {
        command: "npm test && gh pr create --draft",
      },
    })).toThrow([
      "Direct gh pr create is banned for this workspace.",
      "Use nt_skillz_create_pr instead.",
    ].join("\n"))
  })

  it("blocks direct pull request creation when subshell invokes gh pr create", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([], commandInvocations))

    expect(() => gate.beforeToolExecution({
      tool: "bash",
    }, {
      args: {
        command: "(gh pr create --draft)",
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

  it("blocks commit when command sequence invokes git commit", () => {
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
        command: "npm test && git commit -m 'feat(example): add example'",
      },
    })).toThrow([
      "Commit blocked: TypeScript files changed without nt_skillz_lint validation.",
      "Run nt_skillz_lint with files: [\"src/example.ts\"]",
      "Then retry the commit.",
    ].join("\n"))
  })

  it("blocks commit when environment-prefixed command invokes git commit", () => {
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
        command: "GIT_AUTHOR_NAME=Test git commit -m 'feat(example): add example'",
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

  it("ignores non-bash tool execution", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([], commandInvocations))

    gate.beforeToolExecution({
      tool: "read",
    }, {
      args: {},
    })

    expect(commandInvocations).toStrictEqual([])
  })

  it("allows bash commands that are not guarded", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([], commandInvocations))

    gate.beforeToolExecution({
      tool: "bash",
    }, {
      args: {
        command: "git status --short",
      },
    })

    expect(commandInvocations).toStrictEqual([])
  })

  it("throws command text error when bash command is missing", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([], commandInvocations))

    expect(() => gate.beforeToolExecution({
      tool: "bash",
    }, {
      args: {},
    })).toThrow("Expected bash command text. Got undefined.")
  })

  it("returns git stderr when staged file discovery fails", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([{
      status: 1,
      stdout: "",
      stderr: "fatal: not a repository",
    }], commandInvocations))

    expect(() => gate.beforeToolExecution({
      tool: "bash",
    }, {
      args: {
        command: "git commit -m 'feat(example): add example'",
      },
    })).toThrow("Expected staged TypeScript file discovery to succeed. Got fatal: not a repository.")
  })

  it("returns git stdout when working tree hash fails without stderr", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([{
      status: 1,
      stdout: "hash failed",
      stderr: "",
    }], commandInvocations))

    expect(() => gate.recordLintedFiles(["src/example.ts"])).toThrow("Expected working tree hash for src/example.ts to succeed. Got hash failed.")
  })

  it("returns git status when staged hash fails without output", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([{
      status: 0,
      stdout: "src/example.ts\n",
      stderr: "",
    }, {
      status: 2,
      stdout: "",
      stderr: "",
    }], commandInvocations))

    expect(() => gate.beforeToolExecution({
      tool: "bash",
    }, {
      args: {
        command: "git commit -m 'feat(example): add example'",
      },
    })).toThrow("Expected staged hash for src/example.ts to succeed. Got exit status 2.")
  })

  it("returns git run error when command runner cannot execute", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([{
      status: null,
      stdout: "",
      stderr: "",
      errorMessage: "spawn failed",
    }], commandInvocations))

    expect(() => gate.recordLintedFiles(["src/example.ts"])).toThrow("Expected working tree hash for src/example.ts to run. Got spawn failed.")
  })

  it("ignores non-TypeScript linted files", () => {
    const commandInvocations: CommandInvocation[] = []
    const gate = createGitWorkflowGate("/repo", createCommandRunner([], commandInvocations))

    gate.recordLintedFiles(["README.md"])

    expect(commandInvocations).toStrictEqual([])
  })
})
