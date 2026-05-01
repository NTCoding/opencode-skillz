# opencode-skillz repository guide

Purpose: package OpenCode workflow assets as a plugin.

## Structure

- `index.js`: plugin entrypoint; auto-registers bundled commands and agents.
- `commands/*.md`: command definitions (frontmatter + template body).
- `agents/*.md`: custom agent definitions (frontmatter + full prompt body).
- `src/tools/lint.ts`: OpenCode lint tool entrypoint.
- `src/tools/*-tool.ts`: other OpenCode tool entrypoints.
- `src/tools/infra/<concept>/`: support code used by tools but not itself an OpenCode tool.
- `src/tools/infra/lint/guidance.ts`: lint failure remediation guidance injected by the lint tool.

## Conventions

- Keep command files process-oriented (not tone-oriented).
- Remove all personality from commands and skill content when creating them.
- Put voice and persona behavior in agent prompts.
- Treat reusable skill content as command templates in `commands/`.
- Commands should be manually invoked by default.
- All plugin-provided commands must use the `nt-skillz:` prefix, including code-backed commands.
- Prefer minimal additions; only add new commands when needed.
- Do not add `agent:` in command frontmatter unless the command must force a specific agent.

## Lint guidance mechanism

- `src/tools/lint.ts` prepends lint failures with remediation guidance.
- `src/tools/infra/lint/guidance.ts` owns the generic message and rule-specific guidance.
- Update `src/tools/infra/lint/guidance.ts` when adding portable lint rules that represent design quality, test quality, type-safety, or security constraints.
- Guidance must direct agents to fix the underlying problem, not suppress rules, delete coverage, or weaken assertions.

## Lint boundaries: portable tool rules vs repo-only checks

- `scripts/living-architecture-eslint.config.mjs` is bundled into the lint tool and applies to every codebase that uses `nt_skillz_lint`.
- Do not add opencode-skillz repository organization rules to `scripts/living-architecture-eslint.config.mjs`.
- Only add rules to `scripts/living-architecture-eslint.config.mjs` when the rule is intentionally portable across all target repositories.
- Repository-only checks belong in this repo's local validation flow, such as a dedicated script wired into this repo's `package.json` scripts.
- `scripts/check-tools-folder-boundary.mjs` is a repo-only check. It enforces that top-level `src/tools/*.ts` files are real OpenCode tool entrypoints and support code lives under `src/tools/infra/<concept>/`.
- Before adding any lint rule, decide whether it is portable product behavior or local repository hygiene. Mixing those two scopes is a release-impacting mistake.

## Command writing rules

### Be eplicit, avoid vagueness

Commands are run by agents that may choose different valid-looking tool calls unless the command removes that choice. A command must include the exact operation, command text, query text, arguments, and expected fields when those details are known. This prevents each run from rediscovering APIs, using different command variants, or failing because the agent guessed a tool shape.

Examples:
- Bad: Fetch unresolved GitHub review threads.
- Good: Run `gh pr view "$PR_NUMBER" --json reviewThreads` and read unresolved threads from the returned `reviewThreads` field.
- Good: If GraphQL is required, include the full `gh api graphql ...` command, the full query, variables, and response path.

## Versioning strategy

- Use SemVer in `package.json`.
- Bump `patch` for prompt/wording tweaks that should not break behavior.
- Bump `minor` for new commands/agents or additive frontmatter support.
- Bump `major` for behavioral breaks or removed/renamed commands/agents.
- Every released version should have a git tag `vX.Y.Z`.

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
