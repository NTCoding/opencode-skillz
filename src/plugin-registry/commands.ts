import { registerDontStopCommands } from "../commands/dont-stop/register.js"
import type { CommandDefinition } from "../types.js"
import { buildCommandName } from "./command-names.js"
import { readMarkdownEntries } from "./markdown.js"

function normalizeCommandReference(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim().replace(/_/g, "-")
}

function loadMarkdownCommands(pluginRoot: string): Record<string, CommandDefinition> {
  const rawCommands = readMarkdownEntries(pluginRoot, "commands")
  const commands: Record<string, CommandDefinition> = {}

  function buildComposedTemplate(name: string, stack = new Set<string>()): string {
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
        template = [template, `In addition you must adhere to the following:\n\n${composedTemplate}`]
          .filter(Boolean)
          .join("\n\n")
      }
    }

    stack.delete(name)
    return template.trim()
  }

  for (const [name, rawCommand] of Object.entries(rawCommands)) {
    const description = typeof rawCommand.meta.description === "string" ? rawCommand.meta.description : `Run /${name}`

    const command: CommandDefinition = {
      description,
      template: buildComposedTemplate(name),
    }

    if (typeof rawCommand.meta.agent === "string") command.agent = rawCommand.meta.agent
    if (typeof rawCommand.meta.model === "string") command.model = rawCommand.meta.model
    if (typeof rawCommand.meta.subtask === "boolean") command.subtask = rawCommand.meta.subtask

    commands[name] = command
  }

  return commands
}

export function registerCommands(
  commandConfig: Record<string, CommandDefinition>,
  pluginRoot: string,
): Record<string, CommandDefinition> {
  const markdownCommands = loadMarkdownCommands(pluginRoot)

  for (const [name, command] of Object.entries(markdownCommands)) {
    const commandName = buildCommandName(name)
    if (!commandConfig[commandName]) {
      commandConfig[commandName] = command
    }
  }

  registerDontStopCommands(commandConfig)
  return markdownCommands
}
