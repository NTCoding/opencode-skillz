export interface CommandDefinition {
  description?: string
  template: string
  agent?: string
  model?: string
  subtask?: boolean
}

export interface AgentDefinition {
  prompt: string
  description?: string
  mode?: string
  model?: string
  color?: string
  disable?: boolean
}

export interface PluginConfig {
  command?: Record<string, CommandDefinition>
  agent?: Record<string, AgentDefinition>
  default_agent?: string
}

export interface CommandExecuteBeforeInput {
  command: string
  sessionID: string
  arguments: string
}

export interface CommandExecuteBeforeOutput {
  parts: unknown[]
}

export interface ChatSystemTransformInput {
  sessionID?: string
}

export interface ChatSystemTransformOutput {
  system: string[]
}

export interface SessionEvent {
  type: string
  properties?: Record<string, unknown>
}

export interface ToastBody {
  title?: string
  message: string
  variant: "info" | "success" | "warning" | "error"
  duration?: number
}

export interface OpencodeClient {
  tui: {
    showToast(args: { body: ToastBody }): Promise<unknown>
  }
  session: {
    messages(args: { path: { id: string } }): Promise<unknown>
    prompt(args: {
      path: { id: string }
      body: {
        parts: Array<{
          type: "text"
          text: string
        }>
      }
    }): Promise<unknown>
  }
}

export interface PluginHooks {
  config?: (config: PluginConfig) => Promise<void>
  "command.execute.before"?: (
    input: CommandExecuteBeforeInput,
    output: CommandExecuteBeforeOutput,
  ) => Promise<void>
  "experimental.chat.system.transform"?: (
    input: ChatSystemTransformInput,
    output: ChatSystemTransformOutput,
  ) => Promise<void>
  event?: (input: { event: SessionEvent }) => Promise<void>
}

export interface PluginInput {
  client: OpencodeClient
}
