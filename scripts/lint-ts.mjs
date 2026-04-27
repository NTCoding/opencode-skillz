import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

class UsageError extends Error {
  constructor(message) {
    super(message)
  }
}

class GitCommandError extends Error {
  constructor(message) {
    super(message)
  }
}

class MissingLocalDependencyError extends Error {
  constructor(message) {
    super(message)
  }
}

class LintExecutionError extends Error {
  constructor(message) {
    super(message)
  }
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const toolRepositoryRoot = path.resolve(scriptDirectory, '..')
const eslintCliPath = path.join(toolRepositoryRoot, 'node_modules', 'eslint', 'bin', 'eslint.js')
const eslintConfigPath = path.join(toolRepositoryRoot, 'scripts', 'living-architecture-eslint.config.mjs')

const printUsage = () => {
  const usage = [
    'Usage: ./scripts/lint-ts.sh [--repo PATH] [--base REF] [--head REF] [file ...]',
    '',
    'Examples:',
    '  ./scripts/lint-ts.sh --repo ../living-architecture --base origin/main',
    '  ./scripts/lint-ts.sh --repo ../living-architecture packages/example/src/example.ts',
    '  ./scripts/lint-ts.sh src/example.ts',
  ].join('\n')

  process.stdout.write(`${usage}\n`)
}

const parseCommandLine = () => {
  return parseArgs({
    options: {
      repo: { type: 'string' },
      base: { type: 'string' },
      head: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })
}

const resolveDirectory = (directoryPath) => {
  const absoluteDirectoryPath = path.resolve(directoryPath)

  if (!fs.existsSync(absoluteDirectoryPath)) {
    throw new UsageError(`Expected repository path to exist. Got ${absoluteDirectoryPath}.`)
  }

  if (!fs.statSync(absoluteDirectoryPath).isDirectory()) {
    throw new UsageError(`Expected repository path to be a directory. Got ${absoluteDirectoryPath}.`)
  }

  return absoluteDirectoryPath
}

const ensureSupportedFilePath = (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    return
  }

  throw new UsageError(`Expected a TypeScript file path ending in .ts or .tsx. Got ${filePath}.`)
}

const runGit = (repositoryRoot, args) => {
  const gitResult = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
  })

  if (gitResult.error) {
    throw new GitCommandError(`Expected git command to run. Got ${gitResult.error.message}.`)
  }

  if (gitResult.status === 0) {
    return gitResult.stdout
  }

  const errorOutput = gitResult.stderr.trim() || gitResult.stdout.trim() || 'git command failed'
  throw new GitCommandError(`Expected git command to succeed. Got ${errorOutput}.`)
}

const readChangedTypeScriptFiles = (repositoryRoot, baseReference, headReference) => {
  const diffRange = `${baseReference}...${headReference}`
  const output = runGit(repositoryRoot, [
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    diffRange,
    '--',
    '*.ts',
    '*.tsx',
  ])

  return output.split('\n').filter(Boolean)
}

const readTrackedAndUntrackedTypeScriptFiles = (repositoryRoot) => {
  const output = runGit(repositoryRoot, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    '*.ts',
    '*.tsx',
  ])

  return output.split('\n').filter(Boolean)
}

const resolveLintTargets = (repositoryRoot, baseReference, headReference, positionalArguments) => {
  if (positionalArguments.length > 0) {
    positionalArguments.forEach(ensureSupportedFilePath)
    return positionalArguments
  }

  if (baseReference) {
    return readChangedTypeScriptFiles(repositoryRoot, baseReference, headReference)
  }

  return readTrackedAndUntrackedTypeScriptFiles(repositoryRoot)
}

const ensureValidArguments = (baseReference, headReference, positionalArguments) => {
  if (baseReference && positionalArguments.length > 0) {
    throw new UsageError('Expected either explicit file paths or --base. Got both.')
  }

  if (!baseReference && headReference !== 'HEAD') {
    throw new UsageError('Expected --head to be used together with --base.')
  }
}

const ensureLocalDependencies = () => {
  if (fs.existsSync(eslintCliPath)) {
    return
  }

  throw new MissingLocalDependencyError(
    `Expected ESLint dependencies to be installed in ${toolRepositoryRoot}. Run npm install in this repository.`,
  )
}

const runEslint = (repositoryRoot, lintTargets) => {
  const eslintResult = spawnSync(
    process.execPath,
    [eslintCliPath, '--no-config-lookup', '--no-warn-ignored', '--config', eslintConfigPath, ...lintTargets],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        NT_SKILLZ_LINT_REPO_ROOT: repositoryRoot,
      },
      stdio: 'inherit',
    },
  )

  if (eslintResult.error) {
    throw new LintExecutionError(`Expected ESLint to run. Got ${eslintResult.error.message}.`)
  }

  if (typeof eslintResult.status === 'number') {
    return eslintResult.status
  }

  throw new LintExecutionError(`Expected ESLint to exit with a status code. Got signal ${eslintResult.signal}.`)
}

const main = () => {
  const parsedArguments = parseCommandLine()

  if (parsedArguments.values.help) {
    printUsage()
    return 0
  }

  const repositoryRoot = resolveDirectory(parsedArguments.values.repo ?? process.cwd())
  const baseReference = parsedArguments.values.base
  const headReference = parsedArguments.values.head ?? 'HEAD'
  const positionalArguments = parsedArguments.positionals

  ensureValidArguments(baseReference, headReference, positionalArguments)
  ensureLocalDependencies()

  const lintTargets = resolveLintTargets(repositoryRoot, baseReference, headReference, positionalArguments)

  if (lintTargets.length === 0) {
    process.stdout.write('No TypeScript files matched.\n')
    return 0
  }

  return runEslint(repositoryRoot, lintTargets)
}

try {
  process.exitCode = main()
} catch (error) {
  const message = error instanceof Error ? error.message : `Expected an error message. Got ${String(error)}.`
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
