import { describe, expect, it } from 'vitest'

import { Semaphore } from '../render-semaphore.js'

describe('Semaphore', () => {
  it('hands a released permit to the queued waiter, not to a fresh acquirer (regression)', async () => {
    // The bug the hand-off fixes: releasing by decrement-then-wake leaves a
    // transient free slot that a caller arriving in the same tick can grab,
    // pushing concurrency to limit + 1. With hand-off the permit goes straight
    // to the waiter and the count never dips.
    const sem = new Semaphore(1)
    await sem.acquire() // A holds the only permit

    let bAcquired = false
    const b = sem.acquire().then(() => {
      bAcquired = true
    })

    sem.release() // permit handed to B

    let cAcquired = false
    void sem.acquire().then(() => {
      cAcquired = true
    }) // C requests in the same tick as the release

    await b
    await Promise.resolve()

    expect(bAcquired).toBe(true)
    expect(cAcquired).toBe(false) // C must still wait — only one permit exists
  })

  it('never lets more than `limit` holders run at once and drains fully', async () => {
    for (const limit of [1, 2, 3]) {
      const sem = new Semaphore(limit)
      let running = 0
      let maxRunning = 0

      const task = async (): Promise<void> => {
        await sem.acquire()
        running += 1
        maxRunning = Math.max(maxRunning, running)
        await Promise.resolve()
        await Promise.resolve()
        running -= 1
        sem.release()
      }

      await Promise.all(Array.from({ length: 30 }, () => task()))

      expect(maxRunning).toBeLessThanOrEqual(limit)
      expect(running).toBe(0)
    }
  })

  it('wakes waiters in FIFO order', async () => {
    const sem = new Semaphore(1)
    const order: number[] = []
    await sem.acquire()

    const w1 = sem.acquire().then(() => order.push(1))
    const w2 = sem.acquire().then(() => order.push(2))
    const w3 = sem.acquire().then(() => order.push(3))

    sem.release()
    await w1
    sem.release()
    await w2
    sem.release()
    await w3

    expect(order).toEqual([1, 2, 3])
  })
})
