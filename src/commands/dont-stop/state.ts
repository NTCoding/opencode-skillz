export interface DontStopSessionState {
  criteria: string[]
  pendingReviewKey?: string
}

export interface DontStopState {
  get(sessionID: string): DontStopSessionState | undefined
  set(sessionID: string, state: DontStopSessionState): void
  clear(sessionID: string): void
  isBusy(sessionID: string): boolean
  startBusy(sessionID: string): void
  finishBusy(sessionID: string): void
}

export function createDontStopState(): DontStopState {
  const sessions = new Map<string, DontStopSessionState>()
  const busySessions = new Set<string>()

  return {
    get(sessionID) {
      return sessions.get(sessionID)
    },
    set(sessionID, state) {
      sessions.set(sessionID, state)
    },
    clear(sessionID) {
      sessions.delete(sessionID)
      busySessions.delete(sessionID)
    },
    isBusy(sessionID) {
      return busySessions.has(sessionID)
    },
    startBusy(sessionID) {
      busySessions.add(sessionID)
    },
    finishBusy(sessionID) {
      busySessions.delete(sessionID)
    },
  }
}
