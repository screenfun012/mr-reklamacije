import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import vm from 'node:vm'

import { describe, expect, it, vi } from 'vitest'

const worker = resolve(process.cwd(), 'public/sw.js')
const manifest = resolve(process.cwd(), 'public/manifest.webmanifest')
const viteConfig = resolve(process.cwd(), 'vite.config.ts')
const TEST_RECIPIENT = '11111111-1111-4111-8111-111111111111'

async function workerHarness(
  dnd: boolean,
  visibleConversationId?: string,
  focused = true,
  activeUserId: string | null = TEST_RECIPIENT,
) {
  const listeners = new Map<
    string,
    (event: { waitUntil: (work: Promise<unknown>) => void; data: unknown }) => void
  >()
  const showNotification = vi.fn(
    (_title: string, options: { renotify?: boolean; tag?: string }) => {
      if (options.renotify === true && options.tag === undefined) {
        throw new TypeError('renotify requires a tag')
      }
    },
  )
  const claim = vi.fn().mockResolvedValue(undefined)
  const skipWaiting = vi.fn().mockResolvedValue(undefined)
  const context: Record<string, unknown> = {
    addEventListener: (type: string, listener: (event: never) => void) =>
      listeners.set(type, listener),
    registration: { showNotification },
    clients: {
      claim,
      matchAll: async () =>
        visibleConversationId === undefined
          ? []
          : [
              {
                visibilityState: 'visible',
                focused,
                url: `https://internal.mrclaims.live/razgovori?razgovor=${visibleConversationId}`,
              },
            ],
      openWindow: vi.fn(),
    },
    skipWaiting,
    indexedDB: {
      open: () => {
        const open: {
          result?: unknown
          onsuccess?: () => void
          onupgradeneeded?: () => void
          onerror?: () => void
        } = {}
        queueMicrotask(() => {
          open.result = {
            close: vi.fn(),
            objectStoreNames: { contains: () => dnd || activeUserId !== null },
            transaction: () => ({
              objectStore: () => ({
                get: (key: string) => {
                  const read: { result?: unknown; onsuccess?: () => void; onerror?: () => void } =
                    {}
                  queueMicrotask(() => {
                    read.result = key === 'dnd' ? dnd : activeUserId
                    read.onsuccess?.()
                  })
                  return read
                },
              }),
            }),
          }
          open.onsuccess?.()
        })
        return open
      },
    },
  }
  context.globalThis = context
  vm.runInContext(await readFile(worker, 'utf8'), vm.createContext(context))

  return {
    claim,
    skipWaiting,
    showNotification,
    async dispatch(type: string, data: { json: () => unknown } | null = null): Promise<void> {
      let work: Promise<unknown> | undefined
      listeners.get(type)?.({ data, waitUntil: (next) => (work = next) })
      await work
    },
    async push(data: { json: () => unknown } | null): Promise<void> {
      let work: Promise<unknown> | undefined
      listeners.get('push')?.({ data, waitUntil: (next) => (work = next) })
      await work
    },
  }
}

describe('the deployable push assets', () => {
  it('identifies the installed app at the root scope', async () => {
    const contents = await readFile(manifest, 'utf8')

    expect(JSON.parse(contents)).toMatchObject({ id: '/', start_url: '/', scope: '/' })
  })

  it('always shows a received push, including malformed payloads and quiet chat states', async () => {
    const contents = await readFile(worker, 'utf8')

    expect(contents).toContain("globalThis.addEventListener('install'")
    expect(contents).toContain('globalThis.skipWaiting()')
    expect(contents).toContain("globalThis.addEventListener('activate'")
    expect(contents).toContain('globalThis.clients.claim()')
    expect(contents).toContain('globalThis.registration.showNotification(')
    expect(contents).toContain('silent,')
    expect(contents).toContain('conversationId !== undefined && !silent')
    expect(contents).not.toContain('if (event.data === null)')
    expect(contents).not.toContain('catch {\n        return')
  })

  it('shows a silent notification for DND, audible notification normally, and fallback for bad data', async () => {
    const lifecycle = await workerHarness(false)
    await lifecycle.dispatch('install')
    await lifecycle.dispatch('activate')
    expect(lifecycle.skipWaiting).toHaveBeenCalledOnce()
    expect(lifecycle.claim).toHaveBeenCalledOnce()

    const quiet = await workerHarness(true)
    await quiet.push({
      json: () => ({
        recipientId: TEST_RECIPIENT,
        conversationId: 'room-1',
        title: 'Tiho',
        body: 'Poruka',
      }),
    })
    expect(quiet.showNotification).toHaveBeenCalledWith(
      'Tiho',
      expect.objectContaining({ silent: true, renotify: false }),
    )

    const visibleRoom = await workerHarness(false, 'room-1')
    await visibleRoom.push({
      json: () => ({
        recipientId: TEST_RECIPIENT,
        conversationId: 'room-1',
        title: 'Otvoreno',
        body: 'Poruka',
      }),
    })
    expect(visibleRoom.showNotification).toHaveBeenCalledWith(
      'Otvoreno',
      expect.objectContaining({ silent: true, renotify: false }),
    )

    const unfocusedRoom = await workerHarness(false, 'room-1', false)
    await unfocusedRoom.push({
      json: () => ({
        recipientId: TEST_RECIPIENT,
        conversationId: 'room-1',
        title: 'U pozadini',
        body: 'Poruka',
      }),
    })
    expect(unfocusedRoom.showNotification).toHaveBeenCalledWith(
      'U pozadini',
      expect.objectContaining({ silent: false, renotify: true }),
    )

    const normal = await workerHarness(false)
    await normal.push({
      json: () => ({
        recipientId: TEST_RECIPIENT,
        conversationId: 'room-1',
        title: 'Novo',
        body: 'Poruka',
      }),
    })
    expect(normal.showNotification).toHaveBeenCalledWith(
      'Novo',
      expect.objectContaining({ silent: false, renotify: true }),
    )

    const malformed = await workerHarness(false)
    await malformed.push({
      json: () => {
        throw new Error('bad payload')
      },
    })
    expect(malformed.showNotification).toHaveBeenCalledWith(
      'MR Interna',
      expect.objectContaining({ silent: true, renotify: false }),
    )

    const empty = await workerHarness(false)
    await empty.push(null)
    expect(empty.showNotification).toHaveBeenCalledWith(
      'MR Interna',
      expect.objectContaining({ silent: true, renotify: false }),
    )

    const emptyTag = await workerHarness(false)
    await emptyTag.push({
      json: () => ({ recipientId: TEST_RECIPIENT, conversationId: '', title: 'Bez sobe' }),
    })
    expect(emptyTag.showNotification).toHaveBeenCalledWith(
      'Bez sobe',
      expect.objectContaining({ silent: false, renotify: false }),
    )

    const wrongAccountWithoutRoom = await workerHarness(
      false,
      undefined,
      true,
      '22222222-2222-4222-8222-222222222222',
    )
    await wrongAccountWithoutRoom.push({
      json: () => ({
        recipientId: TEST_RECIPIENT,
        conversationId: '',
        title: 'Poverljivo bez sobe',
        body: 'Tekst prethodnog naloga',
      }),
    })
    expect(wrongAccountWithoutRoom.showNotification).toHaveBeenCalledWith(
      'MR Interna',
      expect.objectContaining({ body: '', silent: true, renotify: false }),
    )

    const previousAccount = await workerHarness(
      false,
      undefined,
      true,
      '22222222-2222-4222-8222-222222222222',
    )
    await previousAccount.push({
      json: () => ({
        recipientId: TEST_RECIPIENT,
        conversationId: 'room-1',
        title: 'Poverljivo',
        body: 'Tekst prethodnog naloga',
      }),
    })
    expect(previousAccount.showNotification).toHaveBeenCalledWith(
      'MR Interna',
      expect.objectContaining({ body: '', silent: true, renotify: false }),
    )

    const legacyPayload = await workerHarness(
      false,
      undefined,
      true,
      '22222222-2222-4222-8222-222222222222',
    )
    await legacyPayload.push({
      json: () => ({
        conversationId: 'room-1',
        title: 'Stara verzija',
        body: 'Tekst bez identiteta primaoca',
      }),
    })
    expect(legacyPayload.showNotification).toHaveBeenCalledWith(
      'MR Interna',
      expect.objectContaining({ body: '', silent: true, renotify: false }),
    )
  })

  it('prevents a CDN from retaining an obsolete worker', async () => {
    const contents = await readFile(viteConfig, 'utf8')

    expect(contents).toContain("'/sw.js'")
    expect(contents).toContain("'cache-control': 'no-store, no-cache, max-age=0, must-revalidate'")
  })
})
