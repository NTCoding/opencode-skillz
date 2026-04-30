import { describe, expect, it } from "vitest"
import { createPluginRegistry } from "../plugin-registry/index.js"
import type { OpencodeClient } from "../types.js"

const pluginRoot = process.cwd()

const client: OpencodeClient = {
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

describe("createPluginRegistry", () => {
  it("exposes guarded pull request creation tool", () => {
    const registry = createPluginRegistry({ client }, pluginRoot)

    expect(registry.tool?.nt_skillz_create_pr).toBeDefined()
  })

  it("blocks direct gh pr create through tool execution hook", async () => {
    const registry = createPluginRegistry({ client }, pluginRoot)

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
})
