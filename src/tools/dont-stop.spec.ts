import { describe, expect, it } from "vitest"
import { createDontStopHooks } from "../commands/dont-stop/index.js"
import {
  CLEAR_DONT_STOP_COMMAND_NAME,
  DONT_STOP_COMMAND_NAME,
  registerDontStopCommands,
} from "../commands/dont-stop/register.js"
import { createDontStopState } from "../commands/dont-stop/state.js"
import type {
  CommandDefinition,
  OpencodeClient,
  SessionEvent,
  ToastBody,
} from "../types.js"

interface DontStopClient extends OpencodeClient {
  prompts: string[]
  toasts: ToastBody[]
}

interface PromptInput {
  body: {
    parts: Array<{
      type: "text"
      text: string
    }>
  }
}

class PromptFailureError extends Error {
  constructor() {
    super("prompt failed")
  }
}

class DeferredMessages {
  private resolver: ((messages: unknown[]) => void) | undefined

  wait(): Promise<unknown> {
    return new Promise((resolve) => {
      this.resolver = resolve
    })
  }

  resolve(messages: unknown[]): void {
    const resolver = this.resolver

    if (!resolver) {
      throw new PromptFailureError()
    }

    resolver(messages)
  }
}

function createClient(messages: unknown = []): DontStopClient {
  const prompts: string[] = []
  const toasts: ToastBody[] = []

  return {
    prompts,
    toasts,
    tui: {
      async showToast({ body }: { body: ToastBody }): Promise<unknown> {
        toasts.push(body)
        return undefined
      },
    },
    session: {
      async messages(): Promise<unknown> {
        return messages
      },
      async prompt({ body }: PromptInput): Promise<unknown> {
        prompts.push(body.parts.map((part) => part.text).join("\n"))
        return undefined
      },
    },
  }
}

function createIdleEvent(sessionID: string): { event: SessionEvent } {
  return {
    event: {
      type: "session.idle",
      properties: {
        sessionID,
      },
    },
  }
}

describe("createDontStopState", () => {
  it("tracks session criteria and busy state until cleared", () => {
    const state = createDontStopState()

    state.set("session-1", { criteria: ["finish"] })
    state.startBusy("session-1")

    expect(state.get("session-1")).toStrictEqual({ criteria: ["finish"] })
    expect(state.isBusy("session-1")).toBe(true)

    state.finishBusy("session-1")

    expect(state.isBusy("session-1")).toBe(false)

    state.clear("session-1")

    expect(state.get("session-1")).toBeUndefined()
  })
})

describe("registerDontStopCommands", () => {
  it("registers missing commands and preserves existing entries", () => {
    const commands: Record<string, CommandDefinition> = {
      [DONT_STOP_COMMAND_NAME]: {
        description: "Existing",
        template: "Existing template",
      },
    }

    registerDontStopCommands(commands)

    expect(commands[DONT_STOP_COMMAND_NAME]?.template).toBe("Existing template")
    expect(commands[CLEAR_DONT_STOP_COMMAND_NAME]?.template).toBe("dont-stop cleared")
  })

  it("preserves existing clear command entry", () => {
    const commands: Record<string, CommandDefinition> = {
      [CLEAR_DONT_STOP_COMMAND_NAME]: {
        description: "Existing clear",
        template: "Existing clear template",
      },
    }

    registerDontStopCommands(commands)

    expect(commands[CLEAR_DONT_STOP_COMMAND_NAME]?.template).toBe("Existing clear template")
  })
})

describe("createDontStopHooks", () => {
  it("injects system instructions after dont-stop command enables criteria", async () => {
    const client = createClient()
    const hooks = createDontStopHooks(client)
    const output = { parts: ["original"] }

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish coverage; push changes",
    }, output)

    const systemOutput: { system: string[] } = { system: [] }
    await hooks["experimental.chat.system.transform"]?.({ sessionID: "session-1" }, systemOutput)

    expect(output.parts).toStrictEqual([])
    expect(systemOutput.system[0]).toContain("1. finish coverage")
    expect(systemOutput.system[0]).toContain("2. push changes")
    expect(client.toasts.at(-1)?.message).toBe("dont-stop enabled for this session (2 criteria)")
  })

  it("shows error toast when dont-stop command receives no criteria", async () => {
    const client = createClient()
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "  ",
    }, {
      parts: ["original"],
    })

    expect(client.toasts.at(-1)).toStrictEqual({
      message: "/nt-skillz:dont-stop requires acceptance criteria",
      variant: "error",
    })
  })

  it("continues when toast display fails", async () => {
    const client = createClient()
    const hooks = createDontStopHooks(client)
    client.tui.showToast = async (): Promise<unknown> => {
      throw new PromptFailureError()
    }
    const output = { parts: ["original"] }

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, output)

    expect(output.parts).toStrictEqual([])
  })

  it("clears criteria when clear command executes", async () => {
    const client = createClient()
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    await hooks["command.execute.before"]?.({
      command: CLEAR_DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "",
    }, { parts: ["original"] })

    const systemOutput: { system: string[] } = { system: [] }
    await hooks["experimental.chat.system.transform"]?.({ sessionID: "session-1" }, systemOutput)

    expect(systemOutput.system).toStrictEqual([])
    expect(client.toasts.at(-1)?.message).toBe("dont-stop cleared for this session")
  })

  it("continues idle sessions when status does not request review", async () => {
    const client = createClient([])
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    await hooks.event?.(createIdleEvent("session-1"))

    expect(client.prompts[0]).toContain("dont-stop remains active.")
  })

  it("shows review toast when assistant requests completion", async () => {
    const client = createClient([{
      info: { role: "assistant" },
      parts: [{
        type: "text",
        text: [
          "<dont-stop-status>",
          "state: completion-requested",
          "justification: done",
          "reason: all criteria met",
          "</dont-stop-status>",
        ].join("\n"),
      }],
    }])
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    await hooks.event?.(createIdleEvent("session-1"))

    expect(client.toasts.at(-1)?.message).toBe("dont-stop completion requested; run /nt-skillz:clear-dont-stop to accept or reply to continue")
  })

  it("shows review toast once when assistant requests blocker review", async () => {
    const client = createClient([{
      info: { role: "assistant" },
      parts: [{
        type: "text",
        text: [
          "<dont-stop-status>",
          "state: blocked-requested",
          "justification: blocked",
          "reason: needs access",
          "</dont-stop-status>",
        ].join("\n"),
      }],
    }])
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    await hooks.event?.(createIdleEvent("session-1"))
    await hooks.event?.(createIdleEvent("session-1"))

    expect(client.toasts.map((toast) => toast.message)).toStrictEqual([
      "dont-stop enabled for this session (1 criteria)",
      "dont-stop blocker review requested; run /nt-skillz:clear-dont-stop to accept or reply to continue",
    ])
  })

  it("clears deleted sessions and ignores unrelated events", async () => {
    const client = createClient()
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    await hooks.event?.({
      event: {
        type: "session.deleted",
        properties: {
          info: { id: "session-1" },
        },
      },
    })
    await hooks.event?.({ event: { type: "session.updated" } })

    const systemOutput: { system: string[] } = { system: [] }
    await hooks["experimental.chat.system.transform"]?.({ sessionID: "session-1" }, systemOutput)

    expect(systemOutput.system).toStrictEqual([])
  })

  it("ignores malformed session deletion and idle events", async () => {
    const client = createClient()
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    await hooks.event?.({ event: { type: "session.deleted" } })
    await hooks.event?.({
      event: {
        type: "session.deleted",
        properties: { info: "missing" },
      },
    })
    await hooks.event?.({
      event: {
        type: "session.deleted",
        properties: { info: { id: 7 } },
      },
    })
    await hooks.event?.({ event: { type: "session.idle" } })
    await hooks.event?.({
      event: {
        type: "session.idle",
        properties: { sessionID: 7 },
      },
    })

    const systemOutput: { system: string[] } = { system: [] }
    await hooks["experimental.chat.system.transform"]?.({ sessionID: "session-1" }, systemOutput)

    expect(systemOutput.system).toHaveLength(1)
  })

  it("ignores commands and system transforms without active criteria", async () => {
    const client = createClient()
    const hooks = createDontStopHooks(client)
    const commandOutput = { parts: ["original"] }
    const systemOutput: { system: string[] } = { system: [] }

    await hooks["command.execute.before"]?.({
      command: "nt-skillz:other",
      sessionID: "session-1",
      arguments: "finish",
    }, commandOutput)
    await hooks["experimental.chat.system.transform"]?.({}, systemOutput)
    await hooks["experimental.chat.system.transform"]?.({ sessionID: "session-1" }, systemOutput)

    expect(commandOutput.parts).toStrictEqual(["original"])
    expect(systemOutput.system).toStrictEqual([])
  })

  it("continues with parsed status defaults when assistant status is incomplete", async () => {
    const client = createClient({
      data: [{
        info: { role: "assistant" },
        parts: [{
          type: "text",
          text: [
            "<dont-stop-status>",
            "state: paused",
            "</dont-stop-status>",
          ].join("\n"),
        }],
      }],
    })
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    await hooks.event?.(createIdleEvent("session-1"))

    expect(client.prompts[0]).toContain("Last reported state: continue")
    expect(client.prompts[0]).toContain("Last reported reason: ")
  })

  it("continues with missing status when message response is not an array", async () => {
    const client = createClient({ unexpected: true })
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    await hooks.event?.(createIdleEvent("session-1"))

    expect(client.prompts[0]).toContain("Last reported state: missing")
  })

  it("continues with missing status when assistant messages are malformed", async () => {
    const client = createClient([
      null,
      {
        info: { role: "assistant" },
        parts: [null],
      },
      {
        info: { role: "assistant" },
      },
    ])
    const hooks = createDontStopHooks(client)

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    await hooks.event?.(createIdleEvent("session-1"))

    expect(client.prompts[0]).toContain("Last reported state: missing")
  })

  it("ignores busy idle sessions", async () => {
    const deferredMessages = new DeferredMessages()
    const client = createClient()
    const hooks = createDontStopHooks(client)
    client.session.messages = async (): Promise<unknown> => deferredMessages.wait()

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })
    const firstEvent = hooks.event?.(createIdleEvent("session-1"))
    await hooks.event?.(createIdleEvent("session-1"))
    deferredMessages.resolve([])
    await firstEvent

    expect(client.prompts).toHaveLength(1)
  })

  it("keeps busy state clear when prompt continuation fails", async () => {
    const client = createClient()
    const hooks = createDontStopHooks(client)
    client.session.prompt = async (): Promise<unknown> => {
      throw new PromptFailureError()
    }

    await hooks["command.execute.before"]?.({
      command: DONT_STOP_COMMAND_NAME,
      sessionID: "session-1",
      arguments: "finish",
    }, { parts: [] })

    await expect(hooks.event?.(createIdleEvent("session-1"))).rejects.toThrow("prompt failed")

    client.session.prompt = async ({ body }: PromptInput): Promise<unknown> => {
      client.prompts.push(body.parts.map((part) => part.text).join("\n"))
      return undefined
    }
    await hooks.event?.(createIdleEvent("session-1"))

    expect(client.prompts).toHaveLength(1)
  })
})
