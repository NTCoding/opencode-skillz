import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const topLevelToolFilePattern = /^src\/tools\/[^/]+\.ts$/u
const testFilePattern = /\.(?:spec|test)\.ts$/u
const pluginImportPattern = /from\s+["']@opencode-ai\/plugin["']/u
const exportedToolDefinitionPattern = /export\s+(?:const|function)\s+\w+[^\n]*:\s*ToolDefinition/u
const toolCallPattern = /\btool\s*\(/u

const boundaryFailureMessage = 'Top-level src/tools files must export a real OpenCode ToolDefinition. Move support code to src/tools/infra/<concept>/. Renaming a support file to *-tool.ts is not valid.'

export function isTopLevelToolsTypeScriptFile(repositoryRoot, filePath) {
  const relativeFilePath = path.relative(repositoryRoot, filePath).split(path.sep).join('/')
  return topLevelToolFilePattern.test(relativeFilePath) && !testFilePattern.test(relativeFilePath)
}

function hasRealToolDefinition(sourceText) {
  return pluginImportPattern.test(sourceText)
    && sourceText.includes('ToolDefinition')
    && sourceText.includes('tool')
    && exportedToolDefinitionPattern.test(sourceText)
    && toolCallPattern.test(sourceText)
}

function readTopLevelToolsTypeScriptFiles(repositoryRoot) {
  const toolsDirectory = path.join(repositoryRoot, 'src', 'tools')

  if (!fs.existsSync(toolsDirectory)) {
    return []
  }

  return fs.readdirSync(toolsDirectory, { withFileTypes: true })
    .filter((directoryEntry) => directoryEntry.isFile())
    .map((directoryEntry) => path.join(toolsDirectory, directoryEntry.name))
    .filter((filePath) => isTopLevelToolsTypeScriptFile(repositoryRoot, filePath))
}

export function readToolsFolderBoundaryViolations(repositoryRoot) {
  return readTopLevelToolsTypeScriptFiles(repositoryRoot)
    .filter((filePath) => !hasRealToolDefinition(fs.readFileSync(filePath, 'utf8')))
    .map((filePath) => path.relative(repositoryRoot, filePath).split(path.sep).join('/'))
}

export function formatToolsFolderBoundaryViolations(violations) {
  if (violations.length === 0) {
    return ''
  }

  return [
    boundaryFailureMessage,
    ...violations.map((violation) => `- ${violation}`),
  ].join('\n')
}

export function runToolsFolderBoundaryCheck(repositoryRoot = process.cwd(), stderr = process.stderr) {
  const violations = readToolsFolderBoundaryViolations(repositoryRoot)
  const output = formatToolsFolderBoundaryViolations(violations)

  if (!output) {
    return 0
  }

  stderr.write(`${output}\n`)
  return 1
}

export async function runToolsFolderBoundaryScriptMain(currentScriptPath = process.argv[1]) {
  if (currentScriptPath !== fileURLToPath(import.meta.url)) {
    return false
  }

  process.exitCode = runToolsFolderBoundaryCheck()
  return true
}

await runToolsFolderBoundaryScriptMain()
