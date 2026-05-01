import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"
import { createPluginRegistry } from "../plugin-registry/index.js"
import { LINT_TOOL_NAME } from "./lint.js"
import type { OpencodeClient } from "../types.js"

class MissingRegistryToolError extends Error {
  constructor() {
    super("Expected registry lint tool execute function.")
  }
}

function createPluginRoot(): string {
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-plugin-root-"))
  fs.mkdirSync(path.join(pluginRoot, "commands"))
  fs.mkdirSync(path.join(pluginRoot, "agents"))
  return pluginRoot
}

function removePluginRoot(pluginRoot: string): void {
  fs.rmSync(pluginRoot, {
    recursive: true,
    force: true,
  })
}

function createClient(): OpencodeClient {
  return {
    tui: {
      async showToast(): Promise<unknown> {
        return undefined
      },
    },
    session: {
      async messages(): Promise<unknown> {
        return []
      },
      async prompt(): Promise<unknown> {
        return undefined
      },
    },
  }
}

function runGit(repositoryRoot: string, commandArguments: string[]): void {
  spawnSync("/usr/bin/git", commandArguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test User",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test User",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  })
}

function createLintRepository(): string {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-registry-lint-"))
  const sourceDirectory = path.join(repositoryRoot, "src")
  fs.mkdirSync(sourceDirectory)
  fs.writeFileSync(path.join(repositoryRoot, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      verbatimModuleSyntax: true,
    },
    include: ["src/**/*.ts"],
  }))
  fs.writeFileSync(path.join(sourceDirectory, "command.ts"), "export const commandName = \"test\"\n")
  runGit(repositoryRoot, ["init"])
  runGit(repositoryRoot, ["add", "."])
  runGit(repositoryRoot, ["commit", "-m", "feat(test): initial"])
  return repositoryRoot
}

describe("createPluginRegistry lint tool", () => {
  it("records linted files when registry lint tool executes", async () => {
    const repositoryRoot = createLintRepository()
    const pluginRoot = createPluginRoot()
    const registry = createPluginRegistry({
      client: createClient(),
      worktree: repositoryRoot,
    }, pluginRoot)
    const metadataCalls: Array<Record<string, unknown>> = []
    const lintToolDefinition = registry.tool?.[LINT_TOOL_NAME]

    try {
      if (!lintToolDefinition?.execute) throw new MissingRegistryToolError()

      const result = await lintToolDefinition.execute({
        files: ["src/command.ts"],
      }, {
        worktree: repositoryRoot,
        metadata(metadata: Record<string, unknown>): void {
          metadataCalls.push(metadata)
        },
      })
      const currentResult = await lintToolDefinition.execute({
        base: "HEAD",
        head: "HEAD",
      }, {
        worktree: repositoryRoot,
        metadata(metadata: Record<string, unknown>): void {
          metadataCalls.push(metadata)
        },
      })

      expect(result.output).toBe("Lint passed.")
      expect(currentResult.output).toBe("No TypeScript files matched.")
      expect(metadataCalls).toStrictEqual([
        { title: "Lint 1 TypeScript file(s)" },
        { title: "Lint TypeScript changes from HEAD" },
      ])
    } finally {
      removePluginRoot(repositoryRoot)
      removePluginRoot(pluginRoot)
    }
  })
})
