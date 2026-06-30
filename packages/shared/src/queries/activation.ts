import { fetchNoContent } from '../api/fetch-no-content.js'
import type { ActivationCompleteInput } from '../schemas/activation.schema.js'

/** Complete portal activation: set the first password using a one-time token. */
export async function completeActivation(input: ActivationCompleteInput): Promise<void> {
  await fetchNoContent('/api/activation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
