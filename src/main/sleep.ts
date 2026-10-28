/** Remembers when each site was last on screen and decides which loaded pages should sleep. */
export class SleepScheduler {
  private readonly lastUsed = new Map<string, number>()

  constructor(private readonly now: () => number = Date.now) {}

  /** Marks a site as used right now (call when it is shown and when it is left). */
  touch(id: string): void {
    this.lastUsed.set(id, this.now())
  }

  forget(id: string): void {
    this.lastUsed.delete(id)
  }

  /**
   * Loaded pages idle for at least `afterMs`, excluding the visible one and keep-alive sites.
   * `afterMs <= 0` means never sleep.
   */
  due(
    loaded: Iterable<string>,
    options: { activeId: string | null; afterMs: number; keepAlive: (id: string) => boolean }
  ): string[] {
    if (options.afterMs <= 0) return []
    const cutoff = this.now() - options.afterMs
    const result: string[] = []
    for (const id of loaded) {
      if (id === options.activeId || options.keepAlive(id)) continue
      // A page loaded in the background but never shown counts from when it was loaded.
      const last = this.lastUsed.get(id)
      if (last === undefined) this.touch(id)
      else if (last <= cutoff) result.push(id)
    }
    return result
  }
}
