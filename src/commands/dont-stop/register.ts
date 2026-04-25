import type { CommandDefinition } from "../../types.js"
import { buildCommandName } from "../../plugin-registry/command-names.js"

export const DONT_STOP_COMMAND_NAME = buildCommandName("dont-stop")
export const CLEAR_DONT_STOP_COMMAND_NAME = buildCommandName("clear-dont-stop")

const DONT_STOP_TEMPLATE = "dont-stop enabled"
const CLEAR_DONT_STOP_TEMPLATE = "dont-stop cleared"

export function registerDontStopCommands(commandConfig: Record<string, CommandDefinition>): void {
  if (!commandConfig[DONT_STOP_COMMAND_NAME]) {
    commandConfig[DONT_STOP_COMMAND_NAME] = {
      description: "Activate idle continuation for this session",
      template: DONT_STOP_TEMPLATE,
    }
  }

  if (!commandConfig[CLEAR_DONT_STOP_COMMAND_NAME]) {
    commandConfig[CLEAR_DONT_STOP_COMMAND_NAME] = {
      description: "Disable idle continuation for this session",
      template: CLEAR_DONT_STOP_TEMPLATE,
    }
  }
}
