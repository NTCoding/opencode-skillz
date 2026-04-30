import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"
import { runPortableLint } from "./lint.js"

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
})
