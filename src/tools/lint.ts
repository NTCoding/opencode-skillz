import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

import {
  tool,
  type ToolContext,
} from "@opencode-ai/plugin"

class InvalidLintRequestError extends Error {
  constructor(message: string) {
    super(message)
  }
}

class LintRunFailedError extends Error {
  constructor(message: string) {
    super(message)
  }
}

interface LintRequest {
  files?: string[]
  base?: string
  head?: string
}

interface LintRunOutcome {
  exitCode: number
  output: string
}

const lintScriptPath = fileURLToPath(new URL("../../scripts/lint-ts.mjs", import.meta.url))

export const LINT_TOOL_NAME = "nt_skillz_lint"

function validateLintRequest(request: LintRequest): void {
  if (request.base && request.files?.length) {
    throw new InvalidLintRequestError("Expected either file paths or base reference. Got both.")
  }

  if (!request.base && request.head) {
    throw new InvalidLintRequestError("Expected head reference to be used together with base reference.")
  }
}

function createLintCommandArguments(request: LintRequest): string[] {
  const commandArguments = [lintScriptPath]

  if (request.base) {
    commandArguments.push("--base", request.base)

    if (request.head) {
      commandArguments.push("--head", request.head)
    }
  }

  for (const filePath of request.files ?? []) {
    commandArguments.push(filePath)
  }

  return commandArguments
}

function createLintTitle(request: LintRequest): string {
  if (request.files?.length) {
    return `Lint ${request.files.length} TypeScript file(s)`
  }

  if (request.base) {
    return `Lint TypeScript changes from ${request.base}`
  }

  return "Lint current TypeScript files"
}

function createLintOutput(standardOutputParts: string[], standardErrorParts: string[]): string {
  const sections = [standardOutputParts.join("").trim(), standardErrorParts.join("").trim()].filter(Boolean)
  return sections.join("\n")
}

function normalizeExitCode(value: number | null): number {
  if (typeof value === "number") {
    return value
  }

  return 1
}

function runLintCommand(request: LintRequest, context: ToolContext): Promise<LintRunOutcome> {
  return new Promise((resolve, reject) => {
    const lintCommand = spawn(process.execPath, createLintCommandArguments(request), {
      cwd: context.worktree,
      signal: context.abort,
      stdio: ["ignore", "pipe", "pipe"],
    })

    const standardOutputParts: string[] = []
    const standardErrorParts: string[] = []

    lintCommand.stdout.on("data", (chunk: Buffer | string) => {
      standardOutputParts.push(chunk.toString())
    })

    lintCommand.stderr.on("data", (chunk: Buffer | string) => {
      standardErrorParts.push(chunk.toString())
    })

    lintCommand.on("error", (error) => {
      reject(error)
    })

    lintCommand.on("close", (exitCode) => {
      resolve({
        exitCode: normalizeExitCode(exitCode),
        output: createLintOutput(standardOutputParts, standardErrorParts),
      })
    })
  })
}

function createLintFailureMessage(outcome: LintRunOutcome): string {
  if (outcome.output) {
    return outcome.output
  }

  return `Lint failed with exit code ${outcome.exitCode}.`
}

export const lintTool = tool({
  description: "Run bundled TypeScript lint rules against current project files.",
  args: {
    files: tool.schema.array(tool.schema.string()).optional().describe("Relative .ts or .tsx file paths to lint."),
    base: tool.schema.string().optional().describe("Base git reference for PR-style changed-file linting."),
    head: tool.schema.string().optional().describe("Optional head git reference used with base."),
  },
  async execute(request, context) {
    validateLintRequest(request)
    context.metadata({ title: createLintTitle(request) })

    const outcome = await runLintCommand(request, context)

    if (outcome.exitCode !== 0) {
      throw new LintRunFailedError(createLintFailureMessage(outcome))
    }

    return {
      output: outcome.output || "Lint passed.",
      metadata: {
        base: request.base ?? null,
        fileCount: request.files?.length ?? 0,
        head: request.head ?? null,
      },
    }
  },
})
