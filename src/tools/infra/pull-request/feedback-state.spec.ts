import { describe, expect, it } from "vitest"
import {
  formatPullRequestStateDetails,
  formatPullRequestStateSummary,
  type PullRequestStateView,
} from "./feedback-state.js"

function createPullRequestStateView(): PullRequestStateView {
  return {
    mergeable: null,
    reviewDecision: null,
    reviews: [],
    statusCheckRollup: [{
      conclusion: null,
      detailsUrl: "",
      name: "status-state failure",
      state: "FAILURE",
      status: null,
      type: "StatusContext",
    }, {
      conclusion: null,
      detailsUrl: "",
      name: "status fallback error",
      state: null,
      status: "ERROR",
      type: "StatusContext",
    }, {
      conclusion: null,
      detailsUrl: "",
      name: "pending check",
      state: null,
      status: null,
      type: "CheckRun",
    }],
  }
}

describe("pull request feedback state", () => {
  it("formats unknown state values and failed check fallbacks", () => {
    const pullRequestView = createPullRequestStateView()
    const stateDetails = formatPullRequestStateDetails(pullRequestView).join("\n")

    expect({
      details: stateDetails,
      summary: formatPullRequestStateSummary(pullRequestView),
    }).toStrictEqual({
      details: [
        "",
        "## Failed checks",
        "",
        "### Failed check: status-state failure",
        "- Type: StatusContext",
        "- Outcome: FAILURE",
        "- Status: unknown",
        "- Conclusion: unknown",
        "- State: FAILURE",
        "- Details URL: not returned",
        "### Failed check: status fallback error",
        "- Type: StatusContext",
        "- Outcome: ERROR",
        "- Status: ERROR",
        "- Conclusion: unknown",
        "- State: unknown",
        "- Details URL: not returned",
      ].join("\n"),
      summary: [
        "- Mergeable: unknown",
        "- Review decision: unknown",
        "- Changes requested: no",
        "- Changes-requested review history: 0",
        "- Failed checks: 2",
      ],
    })
  })
})
