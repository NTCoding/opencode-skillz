import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = __dirname

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

function loadCommands() {
  const commandsDir = path.join(pluginRoot, "commands")
  const files = readMarkdownFiles(commandsDir)
  const commands = {}

  for (const file of files) {
    const name = file.replace(/\.md$/, "")
    const fullPath = path.join(commandsDir, file)
    const content = fs.readFileSync(fullPath, "utf8")
    const { meta, body } = extractFrontmatter(content)

    const command = {
      description: meta.description || `Run /${name}`,
      template: body.trim(),
    }

    if (meta.agent) command.agent = meta.agent
    if (meta.model) command.model = meta.model
    if (typeof meta.subtask === "boolean") command.subtask = meta.subtask

    commands[name] = command
  }

  return commands
}

function loadAgents() {
  const agentsDir = path.join(pluginRoot, "agents")
  const files = readMarkdownFiles(agentsDir)
  const agents = {}

  for (const file of files) {
    const name = file.replace(/\.md$/, "")
    const fullPath = path.join(agentsDir, file)
    const content = fs.readFileSync(fullPath, "utf8")
    const { meta, body } = extractFrontmatter(content)

    const agent = {
      prompt: body.trim(),
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
        if (!config.command[name]) {
          config.command[name] = command
        }
      }

      const agents = loadAgents()
      for (const [name, agent] of Object.entries(agents)) {
        if (!config.agent[name]) {
          config.agent[name] = agent
        }
      }

      if (!config.default_agent && config.agent.default) {
        config.default_agent = "default"
      }
    },
  }
}

export default OpencodeSkillzPlugin
