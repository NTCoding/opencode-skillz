import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { runPortableLintFromCommandLine } from '../dist/tools/lint.js'

export function readErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return `Expected an error message. Got ${String(error)}.`
}

export async function runLintScript(commandLineArguments, stderr = process.stderr) {
  try {
    return await runPortableLintFromCommandLine(commandLineArguments)
  } catch (error) {
    stderr.write(`${readErrorMessage(error)}\n`)
    return 1
  }
}

export async function runLintScriptMain(currentScriptPath = process.argv[1], commandLineArguments = process.argv.slice(2)) {
  if (currentScriptPath !== fileURLToPath(import.meta.url)) {
    return false
  }

  process.exitCode = await runLintScript(commandLineArguments)
  return true
}

await runLintScriptMain()
