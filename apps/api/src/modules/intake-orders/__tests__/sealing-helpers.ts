import type { IntakeDocumentKind } from '@mr/shared'

import type { IntakeOrdersRepository } from '../intake-orders.repository.js'

/**
 * Signing an intake order fires its document's sealing into the BACKGROUND
 * (`void produceDocumentInBackground(id)`), so a test that signs and then reads the document is
 * racing a Chromium render. On this machine the render usually wins; on a two-core CI runner it
 * does not, and the assertion sees `storagePath: null`.
 *
 * It lives here rather than inside one suite because it was written twice — the document suite had
 * it, the handover suite did not, and the handover suite is the one that went red on CI
 * (2026-08-17). Anything that signs an order and then looks at its paper waits through this.
 */
export async function waitForSealedDocument(
  repository: IntakeOrdersRepository,
  id: string,
  kind: IntakeDocumentKind,
): Promise<Awaited<ReturnType<IntakeOrdersRepository['findDocument']>>> {
  // Generous, because it bounds a real browser render on a shared runner — and it is a backstop
  // against hanging the suite, not a performance expectation.
  const deadline = Date.now() + 20_000
  for (;;) {
    const document = await repository.findDocument(id, kind)
    if (document?.storagePath != null) {
      return document
    }
    if (Date.now() > deadline) {
      throw new Error(`the ${kind} document for ${id} was never sealed`)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}
