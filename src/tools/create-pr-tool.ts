import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { createDraftPullRequest } from "./create-pr.js"
import { childProcessCommandRunner } from "./pull-request-files.js"
import type { CommandRunner } from "../git-workflow-gates.js"

export function createPullRequestToolWithRunner(commandRunner: CommandRunner): ToolDefinition {
  return tool({
    description: "Create a validated draft pull request with required OpenCode workflow gates.",
    args: {
      base: tool.schema.string().describe("Base branch for the pull request."),
      title: tool.schema.string().describe("Pull request title."),
      problem: tool.schema.string().describe("Problem section content."),
      solution: tool.schema.string().describe("Solution section content."),
      acceptanceCriteria: tool.schema.string().describe("Acceptance Criteria section content."),
      architectureAndSoftwareDesign: tool.schema.string().describe("Architecture and software design section content."),
    },
    async execute(request, context) {
      return {
        output: createDraftPullRequest(context.worktree, request, commandRunner),
      }
    },
  })
}

export const createPullRequestTool: ToolDefinition = createPullRequestToolWithRunner(childProcessCommandRunner)
