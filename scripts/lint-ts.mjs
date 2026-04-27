import process from 'node:process'
import { runPortableLintFromCommandLine } from '../dist/tools/lint.js'

try {
  process.exitCode = await runPortableLintFromCommandLine(process.argv.slice(2))
} catch (error) {
  const message = error instanceof Error ? error.message : `Expected an error message. Got ${String(error)}.`
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
