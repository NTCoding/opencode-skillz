import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"
import opencodeSkillzPlugin from "../index.js"
import { createPluginRegistry } from "../plugin-registry/index.js"
import { buildCommandName } from "../plugin-registry/command-names.js"
import { registerCommands } from "../plugin-registry/commands.js"
import { registerAgents } from "../plugin-registry/agents.js"
import { readMarkdownEntries } from "../plugin-registry/markdown.js"
import type {
  AgentDefinition,
  CommandDefinition,
  OpencodeClient,
  PluginConfig,
} from "../types.js"

function createPluginRoot(): string {
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-plugin-root-"))
  fs.mkdirSync(path.join(pluginRoot, "commands"))
  fs.mkdirSync(path.join(pluginRoot, "agents"))
  return pluginRoot
}

function writePluginMarkdown(pluginRoot: string, directoryName: string, fileName: string, content: string): void {
  fs.writeFileSync(path.join(pluginRoot, directoryName, fileName), content)
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

describe("readMarkdownEntries", () => {
  it("returns parsed metadata and trimmed bodies when markdown files contain frontmatter", () => {
    const pluginRoot = createPluginRoot()

    try {
      writePluginMarkdown(pluginRoot, "commands", "deploy.md", [
        "---",
        "description: 'Deploy command'",
        "subtask: true",
        "# ignored",
        "broken-line",
        "---",
        "Deploy the app",
        "",
      ].join("\n"))
      writePluginMarkdown(pluginRoot, "commands", "plain.md", "Plain body\n")
      fs.writeFileSync(path.join(pluginRoot, "commands", "ignored.txt"), "ignored")

      expect(readMarkdownEntries(pluginRoot, "commands")).toStrictEqual({
        deploy: {
          meta: {
            description: "Deploy command",
            subtask: true,
          },
          body: "Deploy the app",
        },
        plain: {
          meta: {},
          body: "Plain body",
        },
      })
    } finally {
      removePluginRoot(pluginRoot)
    }
  })

  it("returns empty entries when markdown directory does not exist", () => {
    const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-empty-root-"))

    try {
      expect(readMarkdownEntries(pluginRoot, "missing")).toStrictEqual({})
    } finally {
      removePluginRoot(pluginRoot)
    }
  })
})

describe("registerCommands", () => {
  it("registers namespaced commands with composed templates and frontmatter fields", () => {
    const pluginRoot = createPluginRoot()
    const commandConfig: Record<string, CommandDefinition> = {}

    try {
      writePluginMarkdown(pluginRoot, "commands", "base.md", [
        "---",
        "description: Base command",
        "agent: default",
        "model: provider/model",
        "subtask: true",
        "---",
        "Base body",
      ].join("\n"))
      writePluginMarkdown(pluginRoot, "commands", "feature.md", [
        "---",
        "compose_after: base",
        "---",
        "Feature body",
      ].join("\n"))
      writePluginMarkdown(pluginRoot, "commands", "cycle.md", [
        "---",
        "compose_after: cycle",
        "---",
        "Cycle body",
      ].join("\n"))

      const markdownCommands = registerCommands(commandConfig, pluginRoot)

      expect(markdownCommands.feature.template).toBe([
        "Feature body",
        "In addition you must adhere to the following:",
        "Base body",
      ].join("\n\n"))
      expect(commandConfig["nt-skillz:base"]).toStrictEqual({
        description: "Base command",
        template: "Base body",
        agent: "default",
        model: "provider/model",
        subtask: true,
      })
      expect(commandConfig["nt-skillz:dont-stop"]?.template).toBe("dont-stop enabled")
      expect(markdownCommands.cycle.template).toBe([
        "Cycle body",
        "In addition you must adhere to the following:",
        "Cycle body",
      ].join("\n\n"))
    } finally {
      removePluginRoot(pluginRoot)
    }
  })

  it("preserves existing command entries when namespaced command already exists", () => {
    const pluginRoot = createPluginRoot()
    const commandConfig: Record<string, CommandDefinition> = {
      "nt-skillz:base": {
        description: "Existing command",
        template: "Existing body",
      },
    }

    try {
      writePluginMarkdown(pluginRoot, "commands", "base.md", "New body")
      registerCommands(commandConfig, pluginRoot)

      expect(commandConfig["nt-skillz:base"]).toStrictEqual({
        description: "Existing command",
        template: "Existing body",
      })
    } finally {
      removePluginRoot(pluginRoot)
    }
  })
})

describe("registerAgents", () => {
  it("registers agents with parent prompts, preloaded commands, and optional properties", () => {
    const pluginRoot = createPluginRoot()
    const agentConfig: Record<string, AgentDefinition> = {}
    const commands: Record<string, CommandDefinition> = {
      implement: {
        template: "Implement $ARGUMENTS",
      },
      review: {
        template: "Review work",
      },
    }

    try {
      writePluginMarkdown(pluginRoot, "agents", "base.md", [
        "---",
        "preload_commands: implement",
        "---",
        "Base prompt",
      ].join("\n"))
      writePluginMarkdown(pluginRoot, "agents", "builder.md", [
        "---",
        "description: Builder agent",
        "mode: primary",
        "model: provider/model",
        "color: accent",
        "extends: base",
        "preload_commands: implement, review, missing",
        "---",
        "Builder prompt",
      ].join("\n"))

      registerAgents(agentConfig, pluginRoot, commands)

      expect(agentConfig.builder).toStrictEqual({
        description: "Builder agent",
        mode: "primary",
        model: "provider/model",
        color: "accent",
        prompt: [
          "Base prompt",
          "Builder prompt",
          "[Preloaded command /implement]\nImplement all relevant current work in this session",
          "[Preloaded command /review]\nReview work",
        ].join("\n\n"),
      })
    } finally {
      removePluginRoot(pluginRoot)
    }
  })

  it("uses current agent body when parent has no body and preserves cyclic preloads", () => {
    const pluginRoot = createPluginRoot()
    const agentConfig: Record<string, AgentDefinition> = {}
    const commands: Record<string, CommandDefinition> = {
      implement: {
        template: "Implement work",
      },
    }

    try {
      writePluginMarkdown(pluginRoot, "agents", "base.md", [
        "---",
        "extends: builder",
        "preload_commands: implement",
        "---",
        "",
      ].join("\n"))
      writePluginMarkdown(pluginRoot, "agents", "builder.md", [
        "---",
        "extends: base",
        "preload_commands: implement",
        "---",
        "Builder prompt",
      ].join("\n"))

      registerAgents(agentConfig, pluginRoot, commands)

      expect(agentConfig.builder?.prompt).toBe([
        "Builder prompt",
        "[Preloaded command /implement]\nImplement work",
      ].join("\n\n"))
    } finally {
      removePluginRoot(pluginRoot)
    }
  })

  it("preserves existing agent entries when agent config already exists", () => {
    const pluginRoot = createPluginRoot()
    const agentConfig: Record<string, AgentDefinition> = {
      builder: {
        prompt: "Existing prompt",
      },
    }

    try {
      writePluginMarkdown(pluginRoot, "agents", "builder.md", "New prompt")
      registerAgents(agentConfig, pluginRoot, {})

      expect(agentConfig.builder).toStrictEqual({
        prompt: "Existing prompt",
      })
    } finally {
      removePluginRoot(pluginRoot)
    }
  })
})

describe("createPluginRegistry", () => {
  it("registers tools, commands, and agents", async () => {
    const pluginRoot = createPluginRoot()
    const config: PluginConfig = {}

    try {
      writePluginMarkdown(pluginRoot, "commands", "implement.md", "Implement")
      writePluginMarkdown(pluginRoot, "agents", "default.md", "Default prompt")

      const registry = createPluginRegistry({
        client: createClient(),
        worktree: "/repo",
      }, pluginRoot)

      await registry.config?.(config)

      expect(Object.keys(registry.tool ?? {}).sort((left, right) => left.localeCompare(right))).toStrictEqual([
        "nt_skillz_create_pr",
        "nt_skillz_lint",
        "nt_skillz_pr_feedback",
        "nt_skillz_vitest_coverage",
      ])
      expect(config.default_agent).toBe("default")
      expect(config.command?.[buildCommandName("implement")]?.template).toBe("Implement")
    } finally {
      removePluginRoot(pluginRoot)
    }
  })

  it("disables built-in build and plan agents", async () => {
    const pluginRoot = createPluginRoot()
    const config: PluginConfig = {}

    try {
      const registry = createPluginRegistry({
        client: createClient(),
        worktree: "/repo",
      }, pluginRoot)

      await registry.config?.(config)

      expect(config.agent?.build?.disable).toBe(true)
      expect(config.agent?.plan?.disable).toBe(true)
    } finally {
      removePluginRoot(pluginRoot)
    }
  })

  it("blocks direct pull request creation through tool hook", async () => {
    const registry = createPluginRegistry({
      client: createClient(),
      worktree: "/repo",
    }, createPluginRoot())

    await expect(registry["tool.execute.before"]?.({
      tool: "bash",
    }, {
      args: {
        command: "gh pr create --draft",
      },
    })).rejects.toThrow([
      "Direct gh pr create is banned for this workspace.",
      "Use nt_skillz_create_pr instead.",
    ].join("\n"))
  })

  it("creates registry through default plugin entrypoint", async () => {
    const registry = await opencodeSkillzPlugin({
      client: createClient(),
    })

    expect(registry.tool?.nt_skillz_create_pr).toBeDefined()
  })

})
