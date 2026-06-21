import { describe, expect, it } from 'vitest'

import {
  assertIntegrationDatabase,
  DEFAULT_TEST_DATABASE_URL,
  DEV_DATABASE_NAME,
  getIntegrationDatabaseUrl,
  parseDatabaseName,
} from '../integration-db.js'

describe('assertIntegrationDatabase', () => {
  it('accepts default test database URL', () => {
    expect(() => assertIntegrationDatabase(DEFAULT_TEST_DATABASE_URL)).not.toThrow()
  })

  it('refuses dev database name', () => {
    expect(() =>
      assertIntegrationDatabase('postgresql://mr:mr_dev_password@localhost:5433/mr_reklamacije'),
    ).toThrow(DEV_DATABASE_NAME)
  })

  it('refuses databases without _test suffix', () => {
    expect(() =>
      assertIntegrationDatabase('postgresql://mr:mr_dev_password@localhost:5433/mr_staging'),
    ).toThrow('*_test')
  })
})

describe('getIntegrationDatabaseUrl', () => {
  it('returns default test URL when TEST_DATABASE_URL is unset', () => {
    const previous = process.env['TEST_DATABASE_URL']
    delete process.env['TEST_DATABASE_URL']

    expect(getIntegrationDatabaseUrl()).toBe(DEFAULT_TEST_DATABASE_URL)

    if (previous === undefined) {
      delete process.env['TEST_DATABASE_URL']
    } else {
      process.env['TEST_DATABASE_URL'] = previous
    }
  })
})

describe('parseDatabaseName', () => {
  it('extracts database name from URL path', () => {
    expect(parseDatabaseName(DEFAULT_TEST_DATABASE_URL)).toBe('mr_reklamacije_test')
  })
})
