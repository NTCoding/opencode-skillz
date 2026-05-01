import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"
import { registerCommands } from "../plugin-registry/commands.js"
import { readMarkdownEntries } from "../plugin-registry/markdown.js"
import type { CommandDefinition } from "../types.js"

function createPluginRoot(): string {
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-plugin-branches-"))
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

describe("plugin registry branch coverage", () => {
  it("keeps raw template when composed command has empty body", () => {
    const pluginRoot = createPluginRoot()
    const commandConfig: Record<string, CommandDefinition> = {}

    try {
      writePluginMarkdown(pluginRoot, "commands", "empty.md", "")
      writePluginMarkdown(pluginRoot, "commands", "feature.md", [
        "---",
        "compose_after: empty",
        "---",
        "Feature body",
      ].join("\n"))

      const commands = registerCommands(commandConfig, pluginRoot)

      expect(commands.feature.template).toBe("Feature body")
    } finally {
      removePluginRoot(pluginRoot)
    }
  })

  it("parses double quoted frontmatter values", () => {
    const pluginRoot = createPluginRoot()

    try {
      writePluginMarkdown(pluginRoot, "commands", "quoted.md", [
        "---",
        "description: \"Quoted command\"",
        "---",
        "Quoted body",
      ].join("\n"))

      expect(readMarkdownEntries(pluginRoot, "commands").quoted?.meta.description).toBe("Quoted command")
    } finally {
      removePluginRoot(pluginRoot)
    }
  })
})
