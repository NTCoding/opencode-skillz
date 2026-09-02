import path from "node:path"
import { fileURLToPath } from "node:url"

import { createPluginRegistry } from "./plugin-registry/index.js"
import type { PluginInput, PluginOptions } from "./types.js"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = path.resolve(currentDirectory, "..")

export const opencodeSkillzPlugin = async (input: PluginInput, options?: PluginOptions) => createPluginRegistry(input, pluginRoot, options)

export default opencodeSkillzPlugin
