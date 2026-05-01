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

type ActiveDontStopSession = NonNullable<ReturnType<DontStopState["get"]>>

const statusStartMarker = "<dont-stop-status>"
const statusEndMarker = "</dont-stop-status>"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function unwrapResponse(result: unknown): unknown {
  if (isRecord(result) && "data" in result) {
    return result.data
  }

  return result
}

function normalizeCriteria(value: string): string[] {
  return value
    .split(/[\n;]/)
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
  const lowerText = text.toLowerCase()
  const startIndex = lowerText.indexOf(statusStartMarker)
  const endIndex = lowerText.indexOf(statusEndMarker)

  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) return null

  const body = text.slice(startIndex + statusStartMarker.length, endIndex)
  const fields = Object.fromEntries(body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(":"))
    .map((line) => [line.slice(0, line.indexOf(":")).trim(), line.slice(line.indexOf(":") + 1).trim()]))

  const state = parseAssistantState(fields.state)

  return {
    state,
    justification: readStatusField(fields, "justification"),
    reason: readStatusField(fields, "reason"),
  }
}

function readStatusField(fields: Record<string, string>, key: string): string {
  const value = fields[key]

  if (typeof value === "string") {
    return value
  }

  return ""
}

function parseAssistantState(value: string | undefined): AssistantStatus["state"] {
  if (value === "completion-requested" || value === "blocked-requested") {
    return value
  }

  return "continue"
}

async function showToast(client: OpencodeClient, body: ToastBody): Promise<void> {
  const toastWasShown = await client.tui.showToast({ body }).then(
    () => true,
    () => false,
  )

  if (!toastWasShown) return
}

function isMessagePart(value: unknown): value is MessagePart {
  return isRecord(value)
}

function isSessionMessage(value: unknown): value is SessionMessage {
  if (!isRecord(value)) return false

  if (!("parts" in value)) return true

  return Array.isArray(value.parts) && value.parts.every(isMessagePart)
}

function readAssistantText(message: SessionMessage): string {
  const parts = message.parts ?? []

  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
}

async function getLatestAssistantStatus(client: OpencodeClient, sessionID: string): Promise<AssistantStatus | null> {
  const result = unwrapResponse(await client.session.messages({ path: { id: sessionID } }))
  const messages = Array.isArray(result) ? result.filter(isSessionMessage) : []

  const latestAssistantMessage = [...messages].reverse().find((entry) => entry.info?.role === "assistant")
  if (latestAssistantMessage) return parseAssistantStatus(readAssistantText(latestAssistantMessage))

  return null
}

function buildContinuationPrompt(criteria: string[], status: AssistantStatus | null): string {
  const reportedState = status?.state ?? "missing"
  const reason = status?.reason ?? "none"

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
  session: ActiveDontStopSession,
  status: AssistantStatus,
): Promise<void> {
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
  if (!isRecord(properties)) return undefined

  const info = properties.info
  if (!isRecord(info)) return undefined

  return typeof info.id === "string" ? info.id : undefined
}

function getIdleSessionID(event: SessionEvent): string | undefined {
  if (event.type !== "session.idle") return undefined
  const properties = event.properties
  if (!isRecord(properties)) return undefined

  const sessionID = properties.sessionID
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
      await notifyReviewRequested(client, session, latestStatus)
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
