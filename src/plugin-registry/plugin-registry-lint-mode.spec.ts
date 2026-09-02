import { describe, expect, it } from "vitest"
import { createPluginRegistry } from "./index.js"
import { LINT_TOOL_NAME } from "../tools/lint.js"
import type { OpencodeClient } from "../types.js"

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

describe("createPluginRegistry lint mode", () => {
  it("does not register the lint tool when lint mode is disabled", () => {
    const registry = createPluginRegistry({
      client: createClient(),
      worktree: "/repo",
    }, "/plugin", {
      lint: {
        mode: "disabled",
      },
    })

    expect(registry.tool?.[LINT_TOOL_NAME]).toBeUndefined()
  })

  it("rejects unsupported lint modes", () => {
    expect(() => createPluginRegistry({
      client: createClient(),
      worktree: "/repo",
    }, "/plugin", {
      lint: {
        mode: "sometimes",
      },
    })).toThrow("Expected lint.mode to be 'auto', 'manual', or 'disabled'. Got sometimes.")
  })
})
