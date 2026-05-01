import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"
import { installGitHooks, runInstallGitHooksScript } from "../../scripts/install-git-hooks.mjs"
import { readErrorMessage, runLintScript, runLintScriptMain } from "../../scripts/lint-ts.mjs"
import noGenericNames from "../../scripts/no-generic-names-eslint-rule.mjs"

function createRepository() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nt-skillz-script-test-"))
}

function removeRepository(repositoryRoot) {
  fs.rmSync(repositoryRoot, {
    recursive: true,
    force: true,
  })
}

function initializeGitRepository(repositoryRoot) {
  spawnSync("/usr/bin/git", ["init"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
}

function readHookContent(repositoryRoot) {
  return fs.readFileSync(path.join(repositoryRoot, ".git", "hooks", "pre-commit"), "utf8")
}

function collectReports(filename, rule = noGenericNames) {
  const reports = []
  const listener = rule.create({
    getFilename() {
      return filename
    },
    report(report) {
      reports.push(report)
    },
  })

  return {
    reports,
    listener,
  }
}

describe("installGitHooks", () => {
  it("installs pre-commit hook when repository has git directory", () => {
    const repositoryRoot = createRepository()

    try {
      fs.mkdirSync(path.join(repositoryRoot, ".git"))

      expect(installGitHooks(repositoryRoot)).toBe(true)
      expect(readHookContent(repositoryRoot)).toBe("#!/usr/bin/env bash\nset -euo pipefail\nnpm run lint\n")
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("installs pre-commit hook when worktree git file points to git directory", () => {
    const repositoryRoot = createRepository()

    try {
      fs.mkdirSync(path.join(repositoryRoot, "actual-git-directory"))
      fs.writeFileSync(path.join(repositoryRoot, ".git"), "gitdir: actual-git-directory\n")

      expect(installGitHooks(repositoryRoot)).toBe(true)
      expect(fs.readFileSync(path.join(repositoryRoot, "actual-git-directory", "hooks", "pre-commit"), "utf8")).toContain("npm run lint")
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("returns false when repository has no git metadata", () => {
    const repositoryRoot = createRepository()

    try {
      expect(installGitHooks(repositoryRoot)).toBe(false)
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("throws when git file does not contain gitdir prefix", () => {
    const repositoryRoot = createRepository()

    try {
      fs.writeFileSync(path.join(repositoryRoot, ".git"), "broken")

      expect(() => installGitHooks(repositoryRoot)).toThrow("Expected .git file to start with \"gitdir: \". Got broken.")
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("does not run script entrypoint when current script path differs", () => {
    expect(runInstallGitHooksScript("/different/script.mjs")).toBe(false)
  })

  it("runs script entrypoint when current script path matches", () => {
    const repositoryRoot = createRepository()

    try {
      fs.mkdirSync(path.join(repositoryRoot, ".git"))
      const scriptPath = fileURLToPath(new URL("../../scripts/install-git-hooks.mjs", import.meta.url))

      expect(runInstallGitHooksScript(scriptPath, repositoryRoot)).toBe(true)
    } finally {
      removeRepository(repositoryRoot)
    }
  })
})

describe("runLintScript", () => {
  it("returns successful lint exit code when lint command succeeds", async () => {
    const repositoryRoot = createRepository()

    try {
      initializeGitRepository(repositoryRoot)
      const exitCode = await runLintScript(["--repo", repositoryRoot])

      expect(exitCode).toBe(0)
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("writes error message and returns failure exit code when lint command throws", async () => {
    const writtenMessages = []
    const exitCode = await runLintScript(["--repo", "/missing/nt-skillz-repository"], {
      write(value) {
        writtenMessages.push(value)
      },
    })

    expect(exitCode).toBe(1)
    expect(writtenMessages[0]).toContain("Expected repository path to exist.")
  })

  it("does not run lint entrypoint when current script path differs", async () => {
    await expect(runLintScriptMain("/different/script.mjs", [])).resolves.toBe(false)
  })

  it("runs lint entrypoint when current script path matches", async () => {
    const repositoryRoot = createRepository()
    const scriptPath = fileURLToPath(new URL("../../scripts/lint-ts.mjs", import.meta.url))

    try {
      initializeGitRepository(repositoryRoot)

      await expect(runLintScriptMain(scriptPath, ["--repo", repositoryRoot])).resolves.toBe(true)
    } finally {
      removeRepository(repositoryRoot)
    }
  })

  it("formats non-error throw values", () => {
    expect(readErrorMessage("plain failure")).toBe("Expected an error message. Got plain failure.")
  })
})

describe("noGenericNames", () => {
  it("exposes rule metadata", () => {
    expect(noGenericNames.meta).toStrictEqual({
      type: "problem",
      docs: {
        description: "Forbid generic names in filenames and class names.",
        recommended: true,
      },
    })
  })

  it("reports generic filenames and class names", () => {
    const { reports, listener } = collectReports("data-helper.ts")

    listener.Program({})
    listener.ClassDeclaration({ id: { name: "OrderManager" } })

    expect(reports.map((report) => report.message)).toStrictEqual([
      "Generic word \"helper\" in filename. Use a purpose-specific name or fixtures for test data.",
      "Generic word \"manager\" in class \"OrderManager\". Name it for the responsibility it owns.",
    ])
  })

  it("does not report specific filenames or anonymous classes", () => {
    const { reports, listener } = collectReports("order-total.ts")

    listener.Program({})
    listener.ClassDeclaration({ id: null })
    listener.ClassDeclaration({ id: { name: "" } })
    listener.ClassDeclaration({ id: { name: "OrderTotal" } })

    expect(reports).toStrictEqual([])
  })

  it("reports generic class name when no specific forbidden word is found", () => {
    const { reports, listener } = collectReports("order-total.ts")

    listener.ClassDeclaration({ id: { name: "Serviceable" } })

    expect(reports.map((report) => report.message)).toStrictEqual([
      "Generic word \"service\" in class \"Serviceable\". Name it for the domain action it performs.",
    ])
  })

  it("reports plural generic class names", () => {
    const { reports, listener } = collectReports("order-total.ts")

    listener.ClassDeclaration({ id: { name: "Helpers" } })

    expect(reports.map((report) => report.message)).toStrictEqual([
      "Generic word \"helpers\" in class \"Helpers\". Use a purpose-specific name or fixtures for test data.",
    ])
  })

  it("reports generic filenames for each forbidden filename boundary", () => {
    const filenames = ["order-utils.ts", "order/services.tsx", "processor", "order-data"]

    expect(filenames.map((filename) => {
      const { reports, listener } = collectReports(filename)
      listener.Program({})
      return reports[0].message
    })).toStrictEqual([
      "Generic word \"utils\" in filename. Use a domain-specific name that describes what it does.",
      "Generic word \"service\" in filename. Name it for the domain action it performs.",
      "Generic word \"processor\" in filename. Name it for the domain work it performs.",
      "Generic word \"data\" in filename. Name it for the domain concept it represents.",
    ])
  })

  it("ignores class names with generic words in the middle", () => {
    const { reports, listener } = collectReports("order-total.ts")

    listener.ClassDeclaration({ id: { name: "OrderServiceTotal" } })

    expect(reports).toStrictEqual([])
  })

  it("reports generic class names at the start and end of names", () => {
    const { reports, listener } = collectReports("order-total.ts")

    listener.ClassDeclaration({ id: { name: "Manager" } })
    listener.ClassDeclaration({ id: { name: "OrderProcessor" } })

    expect(reports.map((report) => report.message)).toStrictEqual([
      "Generic word \"manager\" in class \"Manager\". Name it for the responsibility it owns.",
      "Generic word \"processor\" in class \"OrderProcessor\". Name it for the domain work it performs.",
    ])
  })

  it("ignores empty filenames", () => {
    const reports = []
    const listener = noGenericNames.create({
      getFilename() {
        return undefined
      },
      report(report) {
        reports.push(report)
      },
    })

    listener.Program({})

    expect(reports).toStrictEqual([])
  })

  it("loads a fresh rule module and reports generic names", async () => {
    const moduleUrl = new URL("../../scripts/no-generic-names-eslint-rule.mjs", import.meta.url)
    const { default: freshRule } = await import(`${moduleUrl.href}?coverage=${Date.now()}`)
    const { reports, listener } = collectReports("service.ts", freshRule)

    listener.Program({})
    listener.ClassDeclaration({ id: { name: "DataManager" } })

    expect(reports.map((report) => report.message)).toStrictEqual([
      "Generic word \"service\" in filename. Name it for the domain action it performs.",
      "Generic word \"manager\" in class \"DataManager\". Name it for the responsibility it owns.",
    ])
  })

  it("loads a fresh rule module and ignores specific names", async () => {
    const moduleUrl = new URL("../../scripts/no-generic-names-eslint-rule.mjs", import.meta.url)
    const { default: freshRule } = await import(`${moduleUrl.href}?specific=${Date.now()}`)
    const { reports, listener } = collectReports("order-total.ts", freshRule)

    listener.Program({})
    listener.ClassDeclaration({ id: null })
    listener.ClassDeclaration({ id: { name: "" } })
    listener.ClassDeclaration({ id: { name: "OrderTotal" } })

    expect(reports).toStrictEqual([])
  })

  it("loads a fresh rule module and ignores empty filenames", async () => {
    const moduleUrl = new URL("../../scripts/no-generic-names-eslint-rule.mjs", import.meta.url)
    const { default: freshRule } = await import(`${moduleUrl.href}?empty=${Date.now()}`)
    const { reports, listener } = collectReports("", freshRule)

    listener.Program({})

    expect(reports).toStrictEqual([])
  })
})

describe("livingArchitectureEslintConfig", () => {
  it("loads config when lint repository root is available", async () => {
    process.env.NT_SKILLZ_LINT_REPO_ROOT = process.cwd()
    const moduleUrl = new URL("../../scripts/living-architecture-eslint.config.mjs", import.meta.url)

    const { default: lintConfig } = await import(`${moduleUrl.href}?root=${Date.now()}`)

    expect(Array.isArray(lintConfig)).toBe(true)
  })

  it("throws when lint repository root is missing", async () => {
    const previousRoot = process.env.NT_SKILLZ_LINT_REPO_ROOT
    delete process.env.NT_SKILLZ_LINT_REPO_ROOT
    const moduleUrl = new URL("../../scripts/living-architecture-eslint.config.mjs", import.meta.url)

    try {
      await expect(import(`${moduleUrl.href}?missing-root=${Date.now()}`))
        .rejects
        .toThrow("Expected NT_SKILLZ_LINT_REPO_ROOT environment variable.")
    } finally {
      if (previousRoot) {
        process.env.NT_SKILLZ_LINT_REPO_ROOT = previousRoot
      }
    }
  })
})
