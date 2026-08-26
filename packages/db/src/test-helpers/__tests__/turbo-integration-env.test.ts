import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

type TurboConfig = {
  tasks: Record<string, { passThroughEnv?: string[] }>
}

const turboConfigPath = fileURLToPath(new URL('../../../../../turbo.json', import.meta.url))

describe('Turbo integration environment', () => {
  it('passes the disposable database URL and timezone to strict integration tasks', () => {
    const config = JSON.parse(readFileSync(turboConfigPath, 'utf8')) as TurboConfig

    expect(config.tasks['test:integration']?.passThroughEnv).toEqual(
      expect.arrayContaining(['TEST_DATABASE_URL', 'TZ']),
    )
  })

  it('keeps the passthrough on integration task overrides', () => {
    const config = JSON.parse(readFileSync(turboConfigPath, 'utf8')) as TurboConfig

    for (const task of ['@mr/auth#test:integration', 'api#test:integration']) {
      expect(config.tasks[task]?.passThroughEnv).toEqual(
        expect.arrayContaining(['TEST_DATABASE_URL', 'TZ']),
      )
    }
  })
})
