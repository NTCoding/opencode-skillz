import fs from 'node:fs'
import path from 'node:path'

const gitDirectory = path.resolve('.git')
const hooksDirectory = path.join(gitDirectory, 'hooks')
const preCommitHookPath = path.join(hooksDirectory, 'pre-commit')

if (fs.existsSync(gitDirectory)) {
  fs.mkdirSync(hooksDirectory, { recursive: true })
  fs.writeFileSync(preCommitHookPath, [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'npm run lint',
    '',
  ].join('\n'), { mode: 0o755 })
}
