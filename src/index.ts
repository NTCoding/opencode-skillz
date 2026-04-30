import path from "node:path"
import { fileURLToPath } from "node:url"

import { createPluginRegistry } from "./plugin-registry/index.js"
import type { PluginInput } from "./types.js"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = path.resolve(currentDirectory, "..")

export const opencodeSkillzPlugin = async (input: PluginInput) => createPluginRegistry(input, pluginRoot)

export default opencodeSkillzPlugin
