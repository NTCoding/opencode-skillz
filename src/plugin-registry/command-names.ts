export const COMMAND_NAMESPACE = "nt-skillz"

export function buildCommandName(name: string): string {
  return `${COMMAND_NAMESPACE}:${name}`
}
