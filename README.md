# opencode-skillz

Bundled OpenCode commands and agents published as an npm package for OpenCode plugins.

## Install

### Option A: npm plugin via `opencode.json`

Add the package name to the plugin list:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@nt-ai-lab/opencode-skillz"]
}
```

This is the simplest update path for consumers: declare the plugin once and keep your package pinning strategy up to date.

### Option B: local typed wrapper plugin file

If a consumer prefers local TypeScript wiring, create a file in `.opencode/plugins/`:

```ts
import OpencodeSkillzPlugin from "@nt-ai-lab/opencode-skillz"

export const OpencodeSkillzPluginAlias = OpencodeSkillzPlugin
```

## Publishing automation

Publishing is fully automated with GitHub Actions.

- The workflow runs on every push to `main`.
- It determines the semantic version bump from the merged PR labels:
  - `release:major` => `major`
  - `release:minor` => `minor`
  - no release label => `patch`
- It updates `package.json` in CI with `npm version <bump> --no-git-tag-version`.
- It publishes the new version to npm.
- After publish succeeds, it commits the updated `package.json` back to `main` using a release commit with `[skip ci]` to prevent workflow loops.
