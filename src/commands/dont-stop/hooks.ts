import {
  CLEAR_DONT_STOP_COMMAND_NAME,
  DONT_STOP_COMMAND_NAME,
} from "./register.js"
import { createDontStopState, type DontStopState } from "./state.js"
import type {
  ChatSystemTransformInput,
  ChatSystemTransformOutput,
  CommandExecuteBeforeInput,
  CommandExecuteBeforeOutput,
  OpencodeClient,
  PluginHooks,
  SessionEvent,
  ToastBody,
} from "../../types.js"

interface AssistantStatus {
  state: "continue" | "completion-requested" | "blocked-requested"
  reason: string
  justification: string
}

interface MessagePart {
  type?: unknown
  text?: unknown
}

interface SessionMessage {
  info?: {
    role?: unknown
  }
  parts?: MessagePart[]
}

function unwrapResponse<T>(result: T | { data: T }): T {
  return typeof result === "object" && result !== null && "data" in result ? result.data : result
}

function normalizeCriteria(value: string): string[] {
  return value
    .split(/\n|;/)
    .map((item) => item.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean)
}

function buildSystemInstruction(criteria: string[]): string {
  return [
    "# dont-stop",
    "",
    "Acceptance criteria:",
    ...criteria.map((item, index) => `${index + 1}. ${item}`),
    "",
    "Rules:",
    "- Continue working until every acceptance criterion is achieved or a concrete blocker exists.",
    "- Do not stop at partial progress.",
    "- Do not ask for confirmation between obvious non-destructive next steps.",
    "- dont-stop stays active until the user explicitly runs /nt-skillz:clear-dont-stop.",
    "- You must never declare the work complete or permanently blocked.",
    "- You may only request completion or request blocked review with a strong and compelling reason.",
    "- End every final response with exactly one machine-readable status block using this format:",
    "",
    "<dont-stop-status>",
    "state: continue|completion-requested|blocked-requested",
    ...criteria.map((item, index) => `criterion-${index + 1}: achieved|not-achieved|unknown - ${item}`),
    "justification: concise evidence-based justification",
    "reason: none|short compelling reason",
    "next: short next action",
    "</dont-stop-status>",
    "",
    "State rules:",
    "- continue = more work should be done now",
    "- completion-requested = you believe the criteria are met and request user approval to stop",
    "- blocked-requested = you believe progress is blocked and request user review of the blocker",
    "- A request does not stop dont-stop. Only the user can clear it.",
  ].join("\n")
}

function parseAssistantStatus(text: string): AssistantStatus | null {
  const match = text.match(/<dont-stop-status>([\s\S]*?)<\/dont-stop-status>/i)
  if (!match) return null

  const body = match[1]
  const stateMatch = body.match(/^\s*state\s*:\s*(continue|completion-requested|blocked-requested)\s*$/im)
  const justificationMatch = body.match(/^\s*justification\s*:\s*(.+)\s*$/im)
  const reasonMatch = body.match(/^\s*reason\s*:\s*(.+)\s*$/im)

  return {
    state: (stateMatch?.[1] as AssistantStatus["state"] | undefined) ?? "continue",
    justification: justificationMatch?.[1]?.trim() ?? "",
    reason: reasonMatch?.[1]?.trim() ?? "",
  }
}

async function showToast(client: OpencodeClient, body: ToastBody): Promise<void> {
  try {
    await client.tui.showToast({ body })
  } catch {}
}

async function getLatestAssistantStatus(client: OpencodeClient, sessionID: string): Promise<AssistantStatus | null> {
  const result = unwrapResponse(await client.session.messages({ path: { id: sessionID } }))
  const messages = Array.isArray(result) ? (result as SessionMessage[]) : []

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index]
    if (entry.info?.role !== "assistant") continue

    const text = (entry.parts ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")

    return parseAssistantStatus(text)
  }

  return null
}

function buildContinuationPrompt(criteria: string[], status: AssistantStatus | null): string {
  const reportedState = status?.state ?? "missing"
  const reason = status?.reason || "none"

  return [
    "dont-stop remains active.",
    "",
    "Acceptance criteria:",
    ...criteria.map((item, index) => `${index + 1}. ${item}`),
    "",
    `Last reported state: ${reportedState}`,
    `Last reported reason: ${reason}`,
    "",
    "If the work seems done, request completion with the required status block.",
    "A completion request must include a clear justification that all acceptance criteria have been achieved.",
    "If a concrete blocker exists, request blocked review with the required status block.",
    "Otherwise continue working immediately on the unmet criteria and end with the required status block.",
  ].join("\n")
}

function buildReviewRequestKey(status: AssistantStatus): string {
  return `${status.state}:${status.reason}`
}

async function notifyReviewRequested(
  client: OpencodeClient,
  state: DontStopState,
  sessionID: string,
  status: AssistantStatus,
): Promise<void> {
  const session = state.get(sessionID)
  if (!session) return

  const reviewKey = buildReviewRequestKey(status)
  if (session.pendingReviewKey === reviewKey) return

  session.pendingReviewKey = reviewKey

  const message =
    status.state === "completion-requested"
      ? "dont-stop completion requested; run /nt-skillz:clear-dont-stop to accept or reply to continue"
      : "dont-stop blocker review requested; run /nt-skillz:clear-dont-stop to accept or reply to continue"

  await showToast(client, {
    message,
    variant: "info",
  })
}

function getDeletedSessionID(event: SessionEvent): string | undefined {
  if (event.type !== "session.deleted") return undefined
  const properties = event.properties
  if (!properties || typeof properties !== "object") return undefined

  const info = (properties as { info?: { id?: unknown } }).info
  return typeof info?.id === "string" ? info.id : undefined
}

function getIdleSessionID(event: SessionEvent): string | undefined {
  if (event.type !== "session.idle") return undefined
  const properties = event.properties
  if (!properties || typeof properties !== "object") return undefined

  const sessionID = (properties as { sessionID?: unknown }).sessionID
  return typeof sessionID === "string" ? sessionID : undefined
}

async function handleCommand(
  client: OpencodeClient,
  state: DontStopState,
  input: CommandExecuteBeforeInput,
  output: CommandExecuteBeforeOutput,
): Promise<void> {
  if (input.command === CLEAR_DONT_STOP_COMMAND_NAME) {
    state.clear(input.sessionID)
    output.parts = []
    await showToast(client, {
      message: "dont-stop cleared for this session",
      variant: "success",
    })
    return
  }

  if (input.command !== DONT_STOP_COMMAND_NAME) return

  const criteria = normalizeCriteria(input.arguments)
  output.parts = []

  if (!criteria.length) {
    await showToast(client, {
      message: "/nt-skillz:dont-stop requires acceptance criteria",
      variant: "error",
    })
    return
  }

  state.set(input.sessionID, { criteria })
  await showToast(client, {
    message: `dont-stop enabled for this session (${criteria.length} criteria)`,
    variant: "success",
  })
}

async function handleSystemTransform(
  state: DontStopState,
  input: ChatSystemTransformInput,
  output: ChatSystemTransformOutput,
): Promise<void> {
  if (!input.sessionID) return

  const session = state.get(input.sessionID)
  if (!session) return

  output.system.push(buildSystemInstruction(session.criteria))
}

async function handleEvent(client: OpencodeClient, state: DontStopState, event: SessionEvent): Promise<void> {
  const deletedSessionID = getDeletedSessionID(event)
  if (deletedSessionID) {
    state.clear(deletedSessionID)
    return
  }

  const sessionID = getIdleSessionID(event)
  if (!sessionID) return

  const session = state.get(sessionID)
  if (!session || state.isBusy(sessionID)) return

  state.startBusy(sessionID)

  try {
    const latestStatus = await getLatestAssistantStatus(client, sessionID)
    if (latestStatus?.state === "completion-requested" || latestStatus?.state === "blocked-requested") {
      await notifyReviewRequested(client, state, sessionID, latestStatus)
      return
    }

    session.pendingReviewKey = undefined

    await client.session.prompt({
      path: { id: sessionID },
      body: {
        parts: [
          {
            type: "text",
            text: buildContinuationPrompt(session.criteria, latestStatus),
          },
        ],
      },
    })
  } finally {
    state.finishBusy(sessionID)
  }
}

export function createDontStopHooks(client: OpencodeClient): PluginHooks {
  const state = createDontStopState()

  return {
    "command.execute.before": async (input, output) => {
      await handleCommand(client, state, input, output)
    },
    "experimental.chat.system.transform": async (input, output) => {
      await handleSystemTransform(state, input, output)
    },
    event: async ({ event }) => {
      await handleEvent(client, state, event)
    },
  }
}
