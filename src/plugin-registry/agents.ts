import type { AgentDefinition, CommandDefinition } from "../types.js"
import { readMarkdownEntries } from "./markdown.js"

function parseCsvList(value: unknown): string[] {
  if (typeof value !== "string") return []

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function materializePreloadedTemplate(template: string): string {
  return template.replaceAll("$ARGUMENTS", "all relevant current work in this session")
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined

  const trimmedValue = value.trim()
  if (!trimmedValue) return undefined

  const parsedValue = Number(trimmedValue)
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

function getParentAgentName(rawAgent: { meta: Record<string, unknown> }): string {
  return typeof rawAgent.meta.extends === "string" ? rawAgent.meta.extends.trim() : ""
}

function appendAgentPromptParts(promptParts: string[], rawAgents: ReturnType<typeof readMarkdownEntries>, name: string): void {
  const rawAgent = rawAgents[name]

  const parentAgentName = getParentAgentName(rawAgent)

  if (parentAgentName && rawAgents[parentAgentName]?.body) {
    promptParts.push(rawAgents[parentAgentName].body)
  }

  if (rawAgent.body) {
    promptParts.push(rawAgent.body)
  }
}

function appendPreloadedCommandPromptParts(
  promptParts: string[],
  commandNames: string[],
  commands: Record<string, CommandDefinition>,
): void {
  for (const commandName of commandNames) {
    const command = commands[commandName]
    if (!command?.template) continue
    promptParts.push(`[Preloaded command /${commandName}]\n${materializePreloadedTemplate(command.template)}`)
  }
}

function setOptionalAgentProperties(agent: AgentDefinition, meta: Record<string, unknown>): void {
  if (typeof meta.description === "string") agent.description = meta.description
  if (typeof meta.mode === "string") agent.mode = meta.mode
  if (typeof meta.model === "string") agent.model = meta.model
  const temperature = parseOptionalNumber(meta.temperature)
  if (temperature !== undefined) agent.temperature = temperature
  if (typeof meta.color === "string") agent.color = meta.color
}

export function registerAgents(
  agentConfig: Record<string, AgentDefinition>,
  pluginRoot: string,
  commands: Record<string, CommandDefinition>,
): void {
  const rawAgents = readMarkdownEntries(pluginRoot, "agents")

  function collectPreloadedCommands(agentName: string, stack = new Set<string>()): string[] {
    const rawAgent = rawAgents[agentName]
    if (stack.has(agentName)) return parseCsvList(rawAgent.meta.preload_commands)

    stack.add(agentName)

    const merged: string[] = []
    const parentAgentName = getParentAgentName(rawAgent)
    if (parentAgentName && rawAgents[parentAgentName]) {
      merged.push(...collectPreloadedCommands(parentAgentName, stack))
    }

    merged.push(...parseCsvList(rawAgent.meta.preload_commands))
    stack.delete(agentName)

    return [...new Set(merged)]
  }

  for (const [name, rawAgent] of Object.entries(rawAgents)) {
    if (agentConfig[name]) continue

    const promptParts: string[] = []
    appendAgentPromptParts(promptParts, rawAgents, name)
    appendPreloadedCommandPromptParts(promptParts, collectPreloadedCommands(name), commands)

    const agent: AgentDefinition = {
      prompt: promptParts.join("\n\n").trim(),
    }

    setOptionalAgentProperties(agent, rawAgent.meta)

    agentConfig[name] = agent
  }
}
