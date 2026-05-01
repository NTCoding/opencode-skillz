import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"
import { runPortableLint } from "./lint.js"

async function createGitRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-huge-base-"))
  spawnSync("/usr/bin/git", ["init"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
  return repositoryRoot
}

describe("runPortableLint git failures", () => {
  it("throws git command run error when diff arguments exceed spawn limit", async () => {
    const repositoryRoot = await createGitRepository()

    try {
      await expect(runPortableLint({
        repositoryRoot,
        base: "x".repeat(3_000_000),
      })).rejects.toThrow("Expected git command to run. Got spawnSync /usr/bin/git E2BIG.")
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })
})
