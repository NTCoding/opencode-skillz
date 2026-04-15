import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = __dirname
const commandNamespace = "nt-skillz"

function buildCommandName(name) {
  return `${commandNamespace}:${name}`
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }

  const meta = {}
  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const idx = line.indexOf(":")
    if (idx <= 0) continue

    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    value = value.replace(/^['\"]|['\"]$/g, "")
    if (value === "true") value = true
    if (value === "false") value = false
    meta[key] = value
  }

  return { meta, body: match[2] }
}

function readMarkdownFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return []
  return fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b))
}

function normalizeCommandReference(value) {
  if (!value || typeof value !== "string") return ""
  return value.trim().replace(/_/g, "-")
}

function loadCommands() {
  const commandsDir = path.join(pluginRoot, "commands")
  const files = readMarkdownFiles(commandsDir)
  const rawCommands = {}

  for (const file of files) {
    const name = file.replace(/\.md$/, "")
    const fullPath = path.join(commandsDir, file)
    const content = fs.readFileSync(fullPath, "utf8")
    const { meta, body } = extractFrontmatter(content)

    rawCommands[name] = {
      meta,
      body: body.trim(),
    }
  }

  const commands = {}

  function buildComposedTemplate(name, stack = new Set()) {
    const rawCommand = rawCommands[name]
    if (!rawCommand) return ""
    if (stack.has(name)) return rawCommand.body

    stack.add(name)

    let template = rawCommand.body
    const composeAfterName = normalizeCommandReference(rawCommand.meta.compose_after)
    const composedCommand = rawCommands[composeAfterName]

    if (composeAfterName && composedCommand) {
      const composedTemplate = buildComposedTemplate(composeAfterName, stack)
      if (composedTemplate) {
        template = [
          template,
          `In addition you must adhere to the following:\n\n${composedTemplate}`,
        ]
          .filter(Boolean)
          .join("\n\n")
      }
    }

    stack.delete(name)

    return template.trim()
  }

  for (const [name, rawCommand] of Object.entries(rawCommands)) {
    const { meta } = rawCommand
    const command = {
      description: meta.description || `Run /${name}`,
      template: buildComposedTemplate(name),
    }

    if (meta.agent) command.agent = meta.agent
    if (meta.model) command.model = meta.model
    if (typeof meta.subtask === "boolean") command.subtask = meta.subtask

    commands[name] = command
  }

  return commands
}

function parseCsvList(value) {
  if (!value || typeof value !== "string") return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function materializePreloadedTemplate(template) {
  return template.replace(/\$ARGUMENTS/g, "all relevant current work in this session")
}

function loadAgents(commands) {
  const agentsDir = path.join(pluginRoot, "agents")
  const files = readMarkdownFiles(agentsDir)
  const rawAgents = {}

  for (const file of files) {
    const name = file.replace(/\.md$/, "")
    const fullPath = path.join(agentsDir, file)
    const content = fs.readFileSync(fullPath, "utf8")
    const { meta, body } = extractFrontmatter(content)

    rawAgents[name] = {
      meta,
      body: body.trim(),
    }
  }

  const agents = {}

  function collectPreloadedCommands(agentName, stack = new Set()) {
    const rawAgent = rawAgents[agentName]
    if (!rawAgent) return []
    if (stack.has(agentName)) return parseCsvList(rawAgent.meta.preload_commands)

    stack.add(agentName)

    const merged = []
    const parentAgentName = typeof rawAgent.meta.extends === "string" ? rawAgent.meta.extends.trim() : ""
    if (parentAgentName && rawAgents[parentAgentName]) {
      merged.push(...collectPreloadedCommands(parentAgentName, stack))
    }

    merged.push(...parseCsvList(rawAgent.meta.preload_commands))
    stack.delete(agentName)

    return [...new Set(merged)]
  }

  for (const [name, raw] of Object.entries(rawAgents)) {
    const { meta, body } = raw
    const promptParts = []

    const parentAgentName = typeof meta.extends === "string" ? meta.extends.trim() : ""
    if (parentAgentName && rawAgents[parentAgentName]) {
      const parentPrompt = rawAgents[parentAgentName].body
      if (parentPrompt) promptParts.push(parentPrompt)
    }

    if (body) {
      promptParts.push(body)
    }

    const preloadedCommands = collectPreloadedCommands(name)
    for (const commandName of preloadedCommands) {
      const command = commands[commandName]
      if (!command || !command.template) continue
      const rendered = materializePreloadedTemplate(command.template)
      promptParts.push(`[Preloaded command /${commandName}]\n${rendered}`)
    }

    const agent = {
      prompt: promptParts.join("\n\n").trim(),
    }

    if (meta.description) agent.description = meta.description
    if (meta.mode) agent.mode = meta.mode
    if (meta.model) agent.model = meta.model
    if (meta.color) agent.color = meta.color

    agents[name] = agent
  }

  return agents
}

export const OpencodeSkillzPlugin = async () => {
  return {
    config: async (config) => {
      config.command = config.command || {}
      config.agent = config.agent || {}

      const commands = loadCommands()
      for (const [name, command] of Object.entries(commands)) {
        const commandName = buildCommandName(name)
        if (!config.command[commandName]) {
          config.command[commandName] = command
        }
      }

      const agents = loadAgents(commands)
      for (const [name, agent] of Object.entries(agents)) {
        if (!config.agent[name]) {
          config.agent[name] = agent
        }
      }

      config.agent.build = {
        ...(config.agent.build || {}),
        disable: true,
      }

      config.agent.plan = {
        ...(config.agent.plan || {}),
        disable: true,
      }

      if (!config.default_agent && config.agent.default) {
        config.default_agent = "default"
      }
    },
  }
}

export default OpencodeSkillzPlugin
