import { z } from "zod"

export const pullRequestReviewSchema = z.object({
  author: z.object({
    login: z.string().min(1),
  }),
  state: z.string().min(1),
  submittedAt: z.string().nullable(),
})

export const statusCheckRollupItemSchema = z.object({
  conclusion: z.string().nullable(),
  detailsUrl: z.string(),
  name: z.string().min(1),
  state: z.string().nullable(),
  status: z.string().nullable(),
  type: z.string().min(1),
})

type PullRequestReview = z.infer<typeof pullRequestReviewSchema>
type StatusCheckRollupItem = z.infer<typeof statusCheckRollupItemSchema>

export interface PullRequestStateView {
  mergeable: string | null
  reviewDecision: string | null
  reviews: PullRequestReview[]
  statusCheckRollup: StatusCheckRollupItem[]
}

const failedCheckOutcomes = new Set([
  "ACTION_REQUIRED",
  "CANCELLED",
  "ERROR",
  "FAILURE",
  "STARTUP_FAILURE",
  "TIMED_OUT",
])

export function createPullRequestViewJqFilter(): string {
  return [
    "{",
    "  baseRefName,",
    "  headRefName,",
    "  id,",
    "  mergeable,",
    "  number,",
    "  reviewDecision,",
    "  reviews: [.reviews[]? | {",
    "    author: { login: (.author.login // \"unknown\") },",
    "    state,",
    "    submittedAt",
    "  }],",
    "  statusCheckRollup: [.statusCheckRollup[]? | {",
    "    conclusion: (.conclusion // null),",
    "    detailsUrl: (.detailsUrl // .targetUrl // \"\"),",
    "    name: (.name // .context // .workflowName // \"unknown\"),",
    "    state: (.state // null),",
    "    status: (.status // null),",
    "    type: (.__typename // \"unknown\")",
    "  }],",
    "  url",
    "}",
  ].join("\n")
}

function readStatusCheckOutcome(statusCheck: StatusCheckRollupItem): string {
  return statusCheck.conclusion ?? statusCheck.state ?? statusCheck.status ?? "UNKNOWN"
}

function readFailedStatusChecks(pullRequestView: PullRequestStateView): StatusCheckRollupItem[] {
  return pullRequestView.statusCheckRollup.filter((statusCheck) => failedCheckOutcomes.has(readStatusCheckOutcome(statusCheck)))
}

function readChangesRequestedReviews(pullRequestView: PullRequestStateView): PullRequestReview[] {
  return pullRequestView.reviews.filter((review) => review.state === "CHANGES_REQUESTED")
}

function formatNullableState(value: string | null): string {
  return value ?? "unknown"
}

function formatBoolean(value: boolean): string {
  return value ? "yes" : "no"
}

export function formatPullRequestStateSummary(pullRequestView: PullRequestStateView): string[] {
  return [
    `- Mergeable: ${formatNullableState(pullRequestView.mergeable)}`,
    `- Review decision: ${formatNullableState(pullRequestView.reviewDecision)}`,
    `- Changes requested: ${formatBoolean(pullRequestView.reviewDecision === "CHANGES_REQUESTED")}`,
    `- Changes-requested review history: ${readChangesRequestedReviews(pullRequestView).length}`,
    `- Failed checks: ${readFailedStatusChecks(pullRequestView).length}`,
  ]
}

function formatChangesRequestedReview(review: PullRequestReview, index: number): string {
  return [
    `### Changes-requested review ${index + 1}`,
    `- Author: ${review.author.login}`,
    `- Submitted: ${formatNullableState(review.submittedAt)}`,
  ].join("\n")
}

function formatChangesRequestedReviewHistory(reviews: PullRequestReview[]): string[] {
  if (reviews.length === 0) return []

  return [
    "",
    "## Changes-requested review history",
    "",
    ...reviews.map(formatChangesRequestedReview),
  ]
}

function formatFailedCheck(statusCheck: StatusCheckRollupItem): string {
  return [
    `### Failed check: ${statusCheck.name}`,
    `- Type: ${statusCheck.type}`,
    `- Outcome: ${readStatusCheckOutcome(statusCheck)}`,
    `- Status: ${formatNullableState(statusCheck.status)}`,
    `- Conclusion: ${formatNullableState(statusCheck.conclusion)}`,
    `- State: ${formatNullableState(statusCheck.state)}`,
    `- Details URL: ${statusCheck.detailsUrl || "not returned"}`,
  ].join("\n")
}

function formatFailedChecks(statusChecks: StatusCheckRollupItem[]): string[] {
  if (statusChecks.length === 0) return []

  return [
    "",
    "## Failed checks",
    "",
    ...statusChecks.map(formatFailedCheck),
  ]
}

export function formatPullRequestStateDetails(pullRequestView: PullRequestStateView): string[] {
  return [
    ...formatChangesRequestedReviewHistory(readChangesRequestedReviews(pullRequestView)),
    ...formatFailedChecks(readFailedStatusChecks(pullRequestView)),
  ]
}
