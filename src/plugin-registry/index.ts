import { createDontStopHooks } from "../commands/dont-stop/index.js"
import {
  LINT_TOOL_NAME,
  lintTool,
} from "../tools/lint.js"
import type {
  PluginHooks,
  PluginInput,
} from "../types.js"
import { registerAgents } from "./agents.js"
import { registerCommands } from "./commands.js"

export function createPluginRegistry(input: PluginInput, pluginRoot: string): PluginHooks {
  const dontStopHooks = createDontStopHooks(input.client)

  return {
    ...dontStopHooks,
    tool: { [LINT_TOOL_NAME]: lintTool },
    config: async (config) => {
      config.command ??= {}
      config.agent ??= {}

      const commands = registerCommands(config.command, pluginRoot)
      registerAgents(config.agent, pluginRoot, commands)

      config.agent.build = {
        ...(config.agent.build ?? {}),
        disable: true,
      }

      config.agent.plan = {
        ...(config.agent.plan ?? {}),
        disable: true,
      }

      if (!config.default_agent && config.agent.default) {
        config.default_agent = "default"
      }
    },
  }
}
