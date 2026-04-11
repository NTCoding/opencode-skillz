# opencode-skillz

Minimal OpenCode plugin that bundles:
- custom commands from `commands/*.md`
- custom agents from `agents/*.md`

## Included in v0.1.0

- `/discuss` command (`commands/discuss.md`)
- `default` agent (`agents/default.md`)

## Install

Add this plugin to your `opencode.json`:

```json
{
  "plugin": ["opencode-skillz@git+https://github.com/<you>/opencode-skillz.git"]
}
```

Or use a local path while developing:

```json
{
  "plugin": ["/absolute/path/to/opencode-skillz"]
}
```

Restart OpenCode after changing plugin config.

## How it works

- Plugin entrypoint: `index.js`
- On startup, plugin reads `commands/*.md` and registers each file as a slash command.
- On startup, plugin reads `agents/*.md` and registers each file as a custom agent.
- If `default_agent` is not set, plugin sets it to `default`.
- Existing user/project commands and agents are not overridden.

## Add a command

Create `commands/<name>.md`:

```md
---
description: My command
---
Command template body here.
```

This becomes `/<name>`.

## Add an agent

Create `agents/<name>.md`:

```md
---
description: My agent
mode: subagent
---
You are my custom agent prompt.
```
