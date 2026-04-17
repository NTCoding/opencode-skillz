import fs from "node:fs"
import path from "node:path"

type FrontmatterValue = string | boolean

export interface MarkdownEntry {
  meta: Record<string, FrontmatterValue>
  body: string
}

function extractFrontmatter(content: string): MarkdownEntry {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }

  const meta: Record<string, FrontmatterValue> = {}
  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const separatorIndex = line.indexOf(":")
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    let value: FrontmatterValue = line.slice(separatorIndex + 1).trim().replace(/^['\"]|['\"]$/g, "")
    if (value === "true") value = true
    if (value === "false") value = false
    meta[key] = value
  }

  return { meta, body: match[2] }
}

function readMarkdownFiles(directoryPath: string): string[] {
  if (!fs.existsSync(directoryPath)) return []

  return fs
    .readdirSync(directoryPath)
    .filter((file) => file.endsWith(".md"))
    .sort((left, right) => left.localeCompare(right))
}

export function readMarkdownEntries(pluginRoot: string, directoryName: string): Record<string, MarkdownEntry> {
  const directoryPath = path.join(pluginRoot, directoryName)
  const files = readMarkdownFiles(directoryPath)
  const entries: Record<string, MarkdownEntry> = {}

  for (const file of files) {
    const name = file.replace(/\.md$/, "")
    const fullPath = path.join(directoryPath, file)
    const content = fs.readFileSync(fullPath, "utf8")
    const entry = extractFrontmatter(content)

    entries[name] = {
      meta: entry.meta,
      body: entry.body.trim(),
    }
  }

  return entries
}
