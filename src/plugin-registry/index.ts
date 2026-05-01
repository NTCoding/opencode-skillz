import process from "node:process"

import { createDontStopHooks } from "../commands/dont-stop/index.js"
import {
  createGitWorkflowGate,
  type GitWorkflowGate,
} from "../git-workflow-gates.js"
import {
  createPullRequestTool,
} from "../tools/create-pr-tool.js"
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
  vitestCoverageTool,
} from "../tools/vitest-coverage-tool.js"
import type {
  PluginHooks,
  PluginInput,
} from "../types.js"
import { registerAgents } from "./agents.js"
import { registerCommands } from "./commands.js"
import { childProcessCommandRunner } from "../tools/infra/source-control/changed-files.js"

function readLintedFilePaths(request: { files?: unknown }): string[] {
  if (!Array.isArray(request.files)) {
    return []
  }

  return request.files.filter((filePath) => typeof filePath === "string")
}

function createGateAwareLintTool(gate: GitWorkflowGate): typeof lintTool {
  return {
    ...lintTool,
    async execute(request, context) {
      const result = await lintTool.execute(request, context)
      gate.recordLintedFiles(readLintedFilePaths(request))
      return result
    },
  }
}

export function createPluginRegistry(input: PluginInput, pluginRoot: string): PluginHooks {
  const dontStopHooks = createDontStopHooks(input.client)
  const gitWorkflowGate = createGitWorkflowGate(input.worktree ?? process.cwd(), childProcessCommandRunner)

  return {
    ...dontStopHooks,
    tool: {
      nt_skillz_create_pr: createPullRequestTool,
      [LINT_TOOL_NAME]: createGateAwareLintTool(gitWorkflowGate),
      [PULL_REQUEST_FEEDBACK_TOOL_NAME]: pullRequestFeedbackTool,
      [VITEST_COVERAGE_TOOL_NAME]: vitestCoverageTool,
    },
    "tool.execute.before": async (hookInput, hookOutput) => {
      gitWorkflowGate.beforeToolExecution(hookInput, hookOutput)
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
