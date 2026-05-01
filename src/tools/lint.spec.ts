import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

import { describe, expect, it, vi } from "vitest"
import { lintTool, runPortableLint, runPortableLintFromCommandLine } from "./lint.js"

interface LintToolContext {
  worktree: string
  metadata(metadata: Record<string, unknown>): void
}

class GitTestCommandError extends Error {
  constructor(message: string) {
    super(message)
  }
}

function createLintToolContext(repositoryRoot: string): LintToolContext & { metadataCalls: Array<Record<string, unknown>> } {
  const metadataCalls: Array<Record<string, unknown>> = []

  return {
    metadataCalls,
    worktree: repositoryRoot,
    metadata(metadata: Record<string, unknown>): void {
      metadataCalls.push(metadata)
    },
  }
}

function runGit(repositoryRoot: string, commandArguments: string[]): void {
  const commandResult = spawnSync("/usr/bin/git", commandArguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test User",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test User",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  })

  if (commandResult.status !== 0) {
    throw new GitTestCommandError(commandResult.stderr || commandResult.stdout)
  }
}

async function createExtensionlessImportRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-"))
  const sourceDirectory = path.join(repositoryRoot, "src")
  const typescriptConfigurationPath = path.join(repositoryRoot, "tsconfig.json")
  const importRequestPath = path.join(sourceDirectory, "import-request.ts")
  const commandPath = path.join(sourceDirectory, "command.ts")

  await mkdir(sourceDirectory)
  await writeFile(typescriptConfigurationPath, JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      verbatimModuleSyntax: true,
    },
    include: ["src/**/*.ts"],
  }))
  await writeFile(importRequestPath, "export const importCompanyRequestName = \"company\"\n")
  await writeFile(commandPath, [
    "import { importCompanyRequestName } from \"./import-request\"",
    "",
    "export function describeImportCompanyRequest(): string {",
    "  return importCompanyRequestName",
    "}",
  ].join("\n"))

  return repositoryRoot
}

describe("runPortableLint", () => {
  it("returns success when local TypeScript import omits extension", async () => {
    const repositoryRoot = await createExtensionlessImportRepository()

    try {
      const lintOutcome = await runPortableLint({
        repositoryRoot,
        files: ["src/command.ts"],
      })

      expect(lintOutcome).toStrictEqual({
        exitCode: 0,
        output: "",
      })
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("returns skip message when repository has no TypeScript files", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-empty-"))

    try {
      runGit(repositoryRoot, ["init"])

      await expect(runPortableLint({ repositoryRoot })).resolves.toStrictEqual({
        exitCode: 0,
        output: "No TypeScript files matched.",
      })
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("throws usage error when repository path is missing", async () => {
    await expect(runPortableLint({
      repositoryRoot: "/missing/nt-skillz-lint-repository",
    })).rejects.toThrow("Expected repository path to exist.")
  })

  it("throws usage error when repository path is a file", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-file-"))
    const filePath = path.join(repositoryRoot, "not-directory")

    try {
      await writeFile(filePath, "not a directory")

      await expect(runPortableLint({
        repositoryRoot: filePath,
      })).rejects.toThrow(`Expected repository path to be a directory. Got ${filePath}.`)
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("throws usage error when file path is not TypeScript", async () => {
    await expect(runPortableLint({
      files: ["README.md"],
    })).rejects.toThrow("Expected a TypeScript file path ending in .ts or .tsx. Got README.md.")
  })

  it("throws bundled asset error when lint config is missing", async () => {
    const existsSync = vi.spyOn(fs, "existsSync").mockImplementation((filePath) => {
      return !String(filePath).endsWith("living-architecture-eslint.config.mjs")
    })

    try {
      await expect(runPortableLint({
        repositoryRoot: process.cwd(),
      })).rejects.toThrow("Expected bundled lint config to exist at")
    } finally {
      existsSync.mockRestore()
    }
  })

  it("throws usage error when base and files are both provided", async () => {
    await expect(runPortableLint({
      base: "main",
      files: ["src/example.ts"],
    })).rejects.toThrow("Expected either file paths or base reference. Got both.")
  })

  it("throws usage error when head is provided without base", async () => {
    await expect(runPortableLint({
      head: "feature",
    })).rejects.toThrow("Expected head reference to be used together with base reference.")
  })

  it("throws git command error when base reference is invalid", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-bad-base-"))

    try {
      runGit(repositoryRoot, ["init"])
      runGit(repositoryRoot, ["commit", "--allow-empty", "-m", "feat(test): initial"])

      await expect(runPortableLint({
        repositoryRoot,
        base: "missing-reference",
      })).rejects.toThrow("Expected git command to succeed. Got fatal: bad revision 'missing-reference...HEAD'.")
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("returns lint errors when file violates bundled lint rules", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-failure-"))
    const sourceDirectory = path.join(repositoryRoot, "src")
    const filePath = path.join(sourceDirectory, "bad.ts")

    try {
      await mkdir(sourceDirectory)
      await writeFile(path.join(repositoryRoot, "tsconfig.json"), JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          skipLibCheck: true,
          verbatimModuleSyntax: true,
        },
        include: ["src/**/*.ts"],
      }))
      await writeFile(filePath, "let badName = 1\n")

      const lintOutcome = await runPortableLint({
        repositoryRoot,
        files: ["src/bad.ts"],
      })

      expect(lintOutcome.exitCode).toBe(1)
      expect(lintOutcome.output).toContain("Use const. Avoid mutation")
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("reads changed TypeScript files from git diff when base reference is provided", async () => {
    const repositoryRoot = await createExtensionlessImportRepository()

    try {
      runGit(repositoryRoot, ["init"])
      runGit(repositoryRoot, ["add", "."])
      runGit(repositoryRoot, ["commit", "-m", "feat(test): initial"])
      fs.appendFileSync(path.join(repositoryRoot, "src", "command.ts"), "\nexport const changedValue = true\n")
      runGit(repositoryRoot, ["add", "."])
      runGit(repositoryRoot, ["commit", "-m", "feat(test): change command"])

      const lintOutcome = await runPortableLint({
        repositoryRoot,
        base: "HEAD~1",
      })

      expect(lintOutcome).toStrictEqual({
        exitCode: 0,
        output: "",
      })
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("returns command line exit code when portable lint command succeeds", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-cli-"))

    try {
      runGit(repositoryRoot, ["init"])

      await expect(runPortableLintFromCommandLine(["--repo", repositoryRoot])).resolves.toBe(0)
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("prints command line help and returns success", async () => {
    await expect(runPortableLintFromCommandLine(["--help"])).resolves.toBe(0)
  })

  it("returns lint tool output and metadata when files mode passes", async () => {
    const repositoryRoot = await createExtensionlessImportRepository()
    const context = createLintToolContext(repositoryRoot)

    try {
      const result = await lintTool.execute({
        files: ["src/command.ts"],
      }, context)

      expect(result).toStrictEqual({
        output: "Lint passed.",
        metadata: {
          base: null,
          fileCount: 1,
          head: null,
        },
      })
      expect(context.metadataCalls).toStrictEqual([{ title: "Lint 1 TypeScript file(s)" }])
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("throws lint tool error when files mode fails", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-tool-fail-"))
    const sourceDirectory = path.join(repositoryRoot, "src")

    try {
      await mkdir(sourceDirectory)
      await writeFile(path.join(repositoryRoot, "tsconfig.json"), JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          skipLibCheck: true,
          verbatimModuleSyntax: true,
        },
        include: ["src/**/*.ts"],
      }))
      await writeFile(path.join(sourceDirectory, "bad.ts"), "let badName = 1\n")

      await expect(lintTool.execute({
        files: ["src/bad.ts"],
      }, createLintToolContext(repositoryRoot))).rejects.toThrow("Use const. Avoid mutation")
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("throws lint tool usage error when mode is invalid", async () => {
    await expect(lintTool.execute({
      mode: "invalid",
    }, createLintToolContext(process.cwd()))).rejects.toThrow("Expected lint mode to be 'files' or 'pr-review'. Got invalid.")
  })

  it("uses files mode and current file title when mode is blank", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-blank-mode-"))
    const context = createLintToolContext(repositoryRoot)

    try {
      runGit(repositoryRoot, ["init"])

      const result = await lintTool.execute({
        mode: " ",
      }, context)

      expect(result).toStrictEqual({
        output: "No TypeScript files matched.",
        metadata: {
          base: null,
          fileCount: 0,
          head: null,
        },
      })
      expect(context.metadataCalls).toStrictEqual([{ title: "Lint current TypeScript files" }])
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("returns pull request lint markdown when pr-review mode is used", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-pr-review-"))
    const context = createLintToolContext(repositoryRoot)

    try {
      runGit(repositoryRoot, ["init"])
      runGit(repositoryRoot, ["commit", "--allow-empty", "-m", "feat(test): initial"])
      const result = await lintTool.execute({
        mode: "pr-review",
        base: "HEAD",
        head: "HEAD",
      }, context)

      expect(result).toStrictEqual({
        output: [
          "<!-- nt-skillz-lint:start -->",
          "## Lint",
          "",
          "No changed TypeScript files.",
          "<!-- nt-skillz-lint:end -->",
        ].join("\n"),
      })
      expect(context.metadataCalls).toStrictEqual([{ title: "Lint pull request TypeScript changes" }])
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("returns lint tool metadata when base mode finds no files", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-base-tool-"))
    const context = createLintToolContext(repositoryRoot)

    try {
      runGit(repositoryRoot, ["init"])
      runGit(repositoryRoot, ["commit", "--allow-empty", "-m", "feat(test): initial"])

      const result = await lintTool.execute({
        base: "HEAD",
        head: "HEAD",
      }, context)

      expect(result).toStrictEqual({
        output: "No TypeScript files matched.",
        metadata: {
          base: "HEAD",
          fileCount: 0,
          head: "HEAD",
        },
      })
      expect(context.metadataCalls).toStrictEqual([{ title: "Lint TypeScript changes from HEAD" }])
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("restores previous lint repository environment after lint run", async () => {
    const repositoryRoot = await createExtensionlessImportRepository()
    process.env.NT_SKILLZ_LINT_REPO_ROOT = "previous-root"

    try {
      await runPortableLint({
        repositoryRoot,
        files: ["src/command.ts"],
      })

      expect(process.env.NT_SKILLZ_LINT_REPO_ROOT).toBe("previous-root")
    } finally {
      delete process.env.NT_SKILLZ_LINT_REPO_ROOT
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })
})
