import type { CommandDefinition } from "../../types.js"
import { buildCommandName } from "../../plugin-registry/command-names.js"

export const DONT_STOP_COMMAND_NAME = buildCommandName("dont-stop")
export const CLEAR_DONT_STOP_COMMAND_NAME = buildCommandName("clear-dont-stop")

export function registerDontStopCommands(commandConfig: Record<string, CommandDefinition>): void {
  if (!commandConfig[DONT_STOP_COMMAND_NAME]) {
    commandConfig[DONT_STOP_COMMAND_NAME] = {
      description: "Activate idle continuation for this session",
      template: "",
    }
  }

  if (!commandConfig[CLEAR_DONT_STOP_COMMAND_NAME]) {
    commandConfig[CLEAR_DONT_STOP_COMMAND_NAME] = {
      description: "Disable idle continuation for this session",
      template: "",
    }
  }
}
