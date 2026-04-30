import {
  tool,
  type ToolDefinition,
} from "@opencode-ai/plugin"
import {
  PULL_REQUEST_FEEDBACK_TOOL_NAME,
  readPullRequestFeedback,
} from "./pull-request-feedback.js"

export const pullRequestFeedbackTool: ToolDefinition = tool({
  description: "Fetch unresolved GitHub pull request review feedback with diff hunks and local code excerpts.",
  args: {
    pullRequestNumber: tool.schema.string().describe("Pull request number from GitHub."),
    pullRequestUrl: tool.schema.string().describe("Full GitHub pull request URL."),
  },
  async execute(request, context) {
    context.metadata({ title: "Fetch unresolved PR feedback" })

    return {
      output: readPullRequestFeedback({
        repositoryRoot: context.worktree,
        pullRequestNumber: request.pullRequestNumber,
        pullRequestUrl: request.pullRequestUrl,
      }),
    }
  },
})

export { PULL_REQUEST_FEEDBACK_TOOL_NAME }
