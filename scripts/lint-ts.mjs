import process from 'node:process'
import { fileURLToPath } from 'node:url'

async function runBundledPortableLint(commandLineArguments) {
  const lintModule = await import('../dist/tools/lint.js')
  return lintModule.runPortableLintFromCommandLine(commandLineArguments)
}

export function readErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return `Expected an error message. Got ${String(error)}.`
}

export async function runLintScript(commandLineArguments, stderr = process.stderr, runPortableLint = runBundledPortableLint) {
  try {
    return await runPortableLint(commandLineArguments)
  } catch (error) {
    stderr.write(`${readErrorMessage(error)}\n`)
    return 1
  }
}

export async function runLintScriptMain(currentScriptPath = process.argv[1], commandLineArguments = process.argv.slice(2), runPortableLint = runBundledPortableLint) {
  if (currentScriptPath !== fileURLToPath(import.meta.url)) {
    return false
  }

  process.exitCode = await runLintScript(commandLineArguments, process.stderr, runPortableLint)
  return true
}

await runLintScriptMain()
