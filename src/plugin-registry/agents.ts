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
  return template.replace(/\$ARGUMENTS/g, "all relevant current work in this session")
}

export function registerAgents(
  agentConfig: Record<string, AgentDefinition>,
  pluginRoot: string,
  commands: Record<string, CommandDefinition>,
): void {
  const rawAgents = readMarkdownEntries(pluginRoot, "agents")

  function collectPreloadedCommands(agentName: string, stack = new Set<string>()): string[] {
    const rawAgent = rawAgents[agentName]
    if (!rawAgent) return []
    if (stack.has(agentName)) return parseCsvList(rawAgent.meta.preload_commands)

    stack.add(agentName)

    const merged: string[] = []
    const parentAgentName = typeof rawAgent.meta.extends === "string" ? rawAgent.meta.extends.trim() : ""
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
    const parentAgentName = typeof rawAgent.meta.extends === "string" ? rawAgent.meta.extends.trim() : ""

    if (parentAgentName && rawAgents[parentAgentName]?.body) {
      promptParts.push(rawAgents[parentAgentName].body)
    }

    if (rawAgent.body) {
      promptParts.push(rawAgent.body)
    }

    for (const commandName of collectPreloadedCommands(name)) {
      const command = commands[commandName]
      if (!command?.template) continue
      promptParts.push(`[Preloaded command /${commandName}]\n${materializePreloadedTemplate(command.template)}`)
    }

    const agent: AgentDefinition = {
      prompt: promptParts.join("\n\n").trim(),
    }

    if (typeof rawAgent.meta.description === "string") agent.description = rawAgent.meta.description
    if (typeof rawAgent.meta.mode === "string") agent.mode = rawAgent.meta.mode
    if (typeof rawAgent.meta.model === "string") agent.model = rawAgent.meta.model
    if (typeof rawAgent.meta.color === "string") agent.color = rawAgent.meta.color

    agentConfig[name] = agent
  }
}
