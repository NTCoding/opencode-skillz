# opencode-skillz

Bundled OpenCode commands and agents published as an npm plugin package.

## Install

### Option A: npm plugin via `opencode.json`

Add the package name to the plugin list:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-skillz"]
}
```

This is the simplest update path: bump version, push tag, and consumers get the new package version when they update config/package pinning.

### Option B: local typed wrapper plugin file

If a consumer prefers local TypeScript wiring, create a file in `.opencode/plugins/`:

```ts
import OpencodeSkillzPlugin from "opencode-skillz"

export const OpencodeSkillzPluginAlias = OpencodeSkillzPlugin
```

## Release

This repository publishes to npm via GitHub Actions when a tag `vX.Y.Z` is pushed.

1. Bump version and create tag:

```bash
npm run release:patch
```

Or use `release:minor` / `release:major`.

2. GitHub Actions workflow publishes to npm when the version tag is pushed.
