import { afterEach, describe, expect, it, vi } from "vitest"

function mockGitFailure(stdout: string, stderr: string, status: number): void {
  vi.doMock("node:child_process", () => ({
    spawnSync: () => ({
      status,
      stdout,
      stderr,
    }),
  }))
}

describe("runPortableLint git failure output", () => {
  afterEach(() => {
    vi.doUnmock("node:child_process")
    vi.resetModules()
  })

  it("throws git stdout when git command fails without stderr", async () => {
    vi.resetModules()
    mockGitFailure("git failed on stdout", "", 1)
    const { runPortableLint } = await import("../../lint.js")

    await expect(runPortableLint({
      repositoryRoot: process.cwd(),
      base: "main",
    })).rejects.toThrow("Expected git command to succeed. Got git failed on stdout.")
  })

  it("throws git exit status when git command fails without output", async () => {
    vi.resetModules()
    mockGitFailure("", "", 2)
    const { runPortableLint } = await import("../../lint.js")

    await expect(runPortableLint({
      repositoryRoot: process.cwd(),
      base: "main",
    })).rejects.toThrow("Expected git command to succeed. Got exit status 2.")
  })
})
