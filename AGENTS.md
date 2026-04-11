# opencode-skillz repository guide

Purpose: package OpenCode workflow assets as a plugin.

## Structure

- `index.js`: plugin entrypoint; auto-registers bundled commands and agents.
- `commands/*.md`: command definitions (frontmatter + template body).
- `agents/*.md`: custom agent definitions (frontmatter + full prompt body).

## Conventions

- Keep command files process-oriented (not tone-oriented).
- Put voice and persona behavior in agent prompts.
- Treat reusable skill content as command templates in `commands/`.
- Commands should be manually invoked by default.
- Prefer minimal additions; only add new commands when needed.
- Do not add `agent:` in command frontmatter unless the command must force a specific agent.

## Versioning strategy

- Use SemVer in `package.json`.
- Bump `patch` for prompt/wording tweaks that should not break behavior.
- Bump `minor` for new commands/agents or additive frontmatter support.
- Bump `major` for behavioral breaks or removed/renamed commands/agents.
- Every released version should have a git tag `vX.Y.Z`.
- Keep `README.md` "Included in" section aligned with the current version.

## Frontmatter support

### Commands

Supported keys in `commands/*.md`:
- `description`
- `agent` (optional)
- `model` (optional)
- `subtask` (optional boolean)

### Agents

Supported keys in `agents/*.md`:
- `description` (optional)
- `mode` (optional)
- `model` (optional)
- `color` (optional)
- `extends` (optional, agent name to prepend prompt from)
- `preload_commands` (optional, comma-separated command names to embed in prompt)

The markdown body becomes the command template or the agent prompt.
