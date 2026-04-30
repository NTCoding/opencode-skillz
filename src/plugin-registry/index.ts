import { createDontStopHooks } from "../commands/dont-stop/index.js"
import {
  LINT_TOOL_NAME,
  lintTool,
} from "../tools/lint.js"
import {
  PULL_REQUEST_FEEDBACK_TOOL_NAME,
  pullRequestFeedbackTool,
} from "../tools/pull-request-feedback-tool.js"
import {
  VITEST_COVERAGE_TOOL_NAME,
} from "../tools/vitest-coverage.js"
import {
  vitestCoverageTool,
} from "../tools/vitest-coverage-tool.js"
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
    tool: {
      [LINT_TOOL_NAME]: lintTool,
      [PULL_REQUEST_FEEDBACK_TOOL_NAME]: pullRequestFeedbackTool,
      [VITEST_COVERAGE_TOOL_NAME]: vitestCoverageTool,
    },
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
