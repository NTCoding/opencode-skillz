import path from "node:path"
import { fileURLToPath } from "node:url"

import { createPluginRegistry } from "./plugin-registry/index.js"
import type { PluginInput } from "./types.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = path.resolve(__dirname, "..")

export const OpencodeSkillzPlugin = async (input: PluginInput) => createPluginRegistry(input, pluginRoot)

export default OpencodeSkillzPlugin
