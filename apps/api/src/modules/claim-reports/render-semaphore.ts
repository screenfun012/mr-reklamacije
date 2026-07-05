/**
 * A counting semaphore with permit HAND-OFF. On release, if a waiter is queued
 * the permit is handed straight to it and the in-use count never dips — so a
 * new acquirer cannot slip into a transient free slot and push concurrency to
 * `limit + 1`. Used to cap concurrent Chromium PDF renders.
 */
export class Semaphore {
  private inUse = 0
  private readonly waiting: Array<() => void> = []

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.inUse < this.limit) {
      this.inUse += 1
      return
    }
    // A woken waiter must NOT re-increment: the releaser held the permit for us.
    await new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    const next = this.waiting.shift()
    if (next !== undefined) {
      next()
      return
    }
    this.inUse -= 1
  }
}
