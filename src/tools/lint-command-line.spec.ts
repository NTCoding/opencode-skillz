import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"
import { runPortableLintFromCommandLine } from "./lint.js"

async function createExtensionlessImportRepository(): Promise<string> {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-cli-empty-output-"))
  const sourceDirectory = path.join(repositoryRoot, "src")

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
  await writeFile(path.join(sourceDirectory, "import-request.ts"), "export const importCompanyRequestName = \"company\"\n")
  await writeFile(path.join(sourceDirectory, "command.ts"), [
    "import { importCompanyRequestName } from \"./import-request\"",
    "",
    "export function describeImportCompanyRequest(): string {",
    "  return importCompanyRequestName",
    "}",
  ].join("\n"))

  return repositoryRoot
}

describe("runPortableLintFromCommandLine", () => {
  it("returns command line exit code without printing when lint output is empty", async () => {
    const repositoryRoot = await createExtensionlessImportRepository()

    try {
      await expect(runPortableLintFromCommandLine(["--repo", repositoryRoot, "src/command.ts"])).resolves.toBe(0)
    } finally {
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })

  it("uses current working directory when repository argument is omitted", async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "nt-skillz-lint-current-directory-"))
    const previousDirectory = process.cwd()

    try {
      spawnSync("/usr/bin/git", ["init"], {
        cwd: repositoryRoot,
        encoding: "utf8",
      })
      process.chdir(repositoryRoot)

      await expect(runPortableLintFromCommandLine([])).resolves.toBe(0)
    } finally {
      process.chdir(previousDirectory)
      await rm(repositoryRoot, {
        recursive: true,
        force: true,
      })
    }
  })
})
