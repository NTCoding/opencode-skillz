import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function resolveGitDirectory(repositoryRoot) {
  const gitPath = path.resolve(repositoryRoot, '.git')

  if (!fs.existsSync(gitPath)) {
    return undefined
  }

  if (fs.statSync(gitPath).isDirectory()) {
    return gitPath
  }

  const gitFileContent = fs.readFileSync(gitPath, 'utf8').trim()
  const gitDirectoryPrefix = 'gitdir: '

  if (!gitFileContent.startsWith(gitDirectoryPrefix)) {
    throw new Error(`Expected .git file to start with "${gitDirectoryPrefix}". Got ${gitFileContent}.`)
  }

  return path.resolve(repositoryRoot, gitFileContent.slice(gitDirectoryPrefix.length))
}

export function installGitHooks(repositoryRoot = process.cwd()) {
  const gitDirectory = resolveGitDirectory(repositoryRoot)

  if (!gitDirectory) {
    return false
  }

  const hooksDirectory = path.join(gitDirectory, 'hooks')
  const preCommitHookPath = path.join(hooksDirectory, 'pre-commit')
  fs.mkdirSync(hooksDirectory, { recursive: true })
  fs.writeFileSync(preCommitHookPath, [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'npm run lint',
    '',
  ].join('\n'), { mode: 0o755 })
  return true
}

export function runInstallGitHooksScript(currentScriptPath = process.argv[1], repositoryRoot = process.cwd()) {
  if (currentScriptPath !== fileURLToPath(import.meta.url)) {
    return false
  }

  return installGitHooks(repositoryRoot)
}

runInstallGitHooksScript()
