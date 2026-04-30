import { tool } from "@opencode-ai/plugin"
import {
  runVitestCoverageReview,
  VITEST_COVERAGE_TOOL_NAME,
} from "./vitest-coverage.js"

export const vitestCoverageTool = tool({
  description: "Run Vitest coverage for changed TypeScript source files.",
  args: {
    mode: tool.schema.string().optional().describe("Use 'pr-review' for pull request coverage."),
    pullRequest: tool.schema.string().optional().describe("Pull request number or URL for pr-review mode."),
    base: tool.schema.string().optional().describe("Base git reference for pr-review mode when no pull request is provided."),
    head: tool.schema.string().optional().describe("Head git reference for pr-review mode when base is provided."),
    files: tool.schema.array(tool.schema.string()).optional().describe("Repository-relative files for files mode."),
  },
  async execute(request, context) {
    context.metadata({ title: "Vitest coverage review" })
    const outcome = await runVitestCoverageReview({
      repositoryRoot: context.worktree,
      mode: request.mode,
      pullRequest: request.pullRequest,
      base: request.base,
      head: request.head,
      files: request.files,
    })

    return {
      output: outcome.markdown,
      metadata: {
        fileCount: outcome.results.length,
        failedCount: outcome.results.filter((result) => result.status !== "passed").length,
      },
    }
  },
})

export { VITEST_COVERAGE_TOOL_NAME }
