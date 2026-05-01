import fs from "node:fs"
import path from "node:path"

export interface CoverageCommandSpec {
  executable: string
  commandArguments: string[]
  workingDirectory: string
  coverageSummaryRoot: string
  coverageSummaryFilePath: string
}

interface CoverageCommandRequest {
  repositoryRoot: string
  filePath: string
  packageRoot: string
  packageRelativeFilePath: string
  reportsDirectory: string
}

class VitestCoverageCommandResolutionError extends Error {}

function formatMissingVitestCommandMessage(checkedBinaryPaths: string[], checkedLockFilePaths: string[]): string {
  return [
    "Expected Vitest binary in one of:",
    ...checkedBinaryPaths.map((binaryPath) => `- ${binaryPath}`),
    "or workspace package manager lockfile in one of:",
    ...checkedLockFilePaths.map((lockFilePath) => `- ${lockFilePath}`),
  ].join("\n")
}

function collectVitestBinaryPathsFromDirectory(repositoryRoot: string, currentDirectory: string, checkedBinaryPaths: string[]): string[] {
  const binaryPath = path.join(currentDirectory, "node_modules", ".bin", "vitest")
  const nextCheckedBinaryPaths = [...checkedBinaryPaths, binaryPath]

  if (currentDirectory === repositoryRoot) {
    return nextCheckedBinaryPaths
  }

  const parentDirectory = path.dirname(currentDirectory)

  return collectVitestBinaryPathsFromDirectory(repositoryRoot, parentDirectory, nextCheckedBinaryPaths)
}

function resolveVitestBinaryPath(checkedBinaryPaths: string[]): string | undefined {
  return checkedBinaryPaths.find((binaryPath) => fs.existsSync(binaryPath))
}

function createVitestArguments(coverageFilePath: string, reportsDirectory: string): string[] {
  return [
    "--run",
    "--coverage.enabled",
    `--coverage.include=${coverageFilePath}`,
    "--coverage.reporter=json-summary",
    "--coverage.reporter=text",
    `--coverage.reportsDirectory=${reportsDirectory}`,
  ]
}

function createDirectVitestCommandSpec(vitestBinaryPath: string, request: CoverageCommandRequest): CoverageCommandSpec {
  return {
    executable: vitestBinaryPath,
    commandArguments: createVitestArguments(request.packageRelativeFilePath, request.reportsDirectory),
    workingDirectory: request.packageRoot,
    coverageSummaryRoot: request.packageRoot,
    coverageSummaryFilePath: request.packageRelativeFilePath,
  }
}

function getCheckedLockFilePaths(repositoryRoot: string): string[] {
  return [
    path.join(repositoryRoot, "yarn.lock"),
    path.join(repositoryRoot, "pnpm-lock.yaml"),
    path.join(repositoryRoot, "package-lock.json"),
    path.join(repositoryRoot, "npm-shrinkwrap.json"),
  ]
}

function createWorkspaceCommandSpec(executable: string, commandArguments: string[], request: CoverageCommandRequest): CoverageCommandSpec {
  return {
    executable,
    commandArguments,
    workingDirectory: request.repositoryRoot,
    coverageSummaryRoot: request.repositoryRoot,
    coverageSummaryFilePath: request.filePath,
  }
}

function createWorkspaceVitestCommandSpec(request: CoverageCommandRequest): CoverageCommandSpec | undefined {
  const vitestArguments = createVitestArguments(request.filePath, request.reportsDirectory)

  if (fs.existsSync(path.join(request.repositoryRoot, "yarn.lock"))) {
    return createWorkspaceCommandSpec("yarn", ["vitest", ...vitestArguments], request)
  }

  if (fs.existsSync(path.join(request.repositoryRoot, "pnpm-lock.yaml"))) {
    return createWorkspaceCommandSpec("pnpm", ["exec", "vitest", ...vitestArguments], request)
  }

  if (fs.existsSync(path.join(request.repositoryRoot, "package-lock.json")) || fs.existsSync(path.join(request.repositoryRoot, "npm-shrinkwrap.json"))) {
    return createWorkspaceCommandSpec("npm", ["exec", "--", "vitest", ...vitestArguments], request)
  }

  return undefined
}

export function createVitestCoverageCommandSpec(request: CoverageCommandRequest): CoverageCommandSpec {
  const checkedBinaryPaths = collectVitestBinaryPathsFromDirectory(path.resolve(request.repositoryRoot), path.resolve(request.packageRoot), [])
  const vitestBinaryPath = resolveVitestBinaryPath(checkedBinaryPaths)

  if (vitestBinaryPath !== undefined) {
    return createDirectVitestCommandSpec(vitestBinaryPath, request)
  }

  const workspaceVitestCommandSpec = createWorkspaceVitestCommandSpec(request)

  if (workspaceVitestCommandSpec !== undefined) {
    return workspaceVitestCommandSpec
  }

  throw new VitestCoverageCommandResolutionError(formatMissingVitestCommandMessage(checkedBinaryPaths, getCheckedLockFilePaths(request.repositoryRoot)))
}
