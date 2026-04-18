import { Writable } from 'node:stream'

import { describe, expect, it, afterEach } from 'vitest'

import { createLogger } from '../logger.js'

function discardStream(): Writable {
  return new Writable({
    write(_chunk, _encoding, cb) {
      cb()
    },
  })
}

describe('createLogger', () => {
  describe('basic API', () => {
    it('returns a logger with standard log methods', () => {
      const logger = createLogger('test', discardStream())
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.trace).toBe('function')
      expect(typeof logger.fatal).toBe('function')
    })

    it('returns a logger with a level property', () => {
      const logger = createLogger('test', discardStream())
      expect(typeof logger.level).toBe('string')
    })

    it('does not throw when called with empty name', () => {
      expect(() => createLogger('', discardStream())).not.toThrow()
    })

    it('defaults to stdout destination when only name is passed', () => {
      const logger = createLogger('stdout-default')
      expect(typeof logger.level).toBe('string')
    })
  })

  describe('log level configuration', () => {
    const ORIGINAL_LOG_LEVEL = process.env['LOG_LEVEL']
    const ORIGINAL_NODE_ENV = process.env['NODE_ENV']

    afterEach(() => {
      if (ORIGINAL_LOG_LEVEL === undefined) {
        delete process.env['LOG_LEVEL']
      } else {
        process.env['LOG_LEVEL'] = ORIGINAL_LOG_LEVEL
      }
      if (ORIGINAL_NODE_ENV === undefined) {
        delete process.env['NODE_ENV']
      } else {
        process.env['NODE_ENV'] = ORIGINAL_NODE_ENV
      }
    })

    it('respects LOG_LEVEL env var when set', () => {
      process.env['LOG_LEVEL'] = 'warn'
      const logger = createLogger('test', discardStream())
      expect(logger.level).toBe('warn')
    })

    it('defaults to "info" level when LOG_LEVEL is not set and not in dev', () => {
      delete process.env['LOG_LEVEL']
      process.env['NODE_ENV'] = 'production'
      const logger = createLogger('test', discardStream())
      expect(logger.level).toBe('info')
    })

    it('defaults to "debug" level in development when LOG_LEVEL is not set', () => {
      delete process.env['LOG_LEVEL']
      process.env['NODE_ENV'] = 'development'
      const logger = createLogger('test', discardStream())
      expect(logger.level).toBe('debug')
    })
  })

  describe('log output structure', () => {
    it('info() does not throw', () => {
      const logger = createLogger('test', discardStream())
      expect(() => logger.info('hello')).not.toThrow()
    })

    it('error() does not throw', () => {
      const logger = createLogger('test', discardStream())
      expect(() => logger.error('something broke')).not.toThrow()
    })

    it('logs include the name property in JSON output', () => {
      const chunks: string[] = []
      const stream = new Writable({
        write(chunk, _encoding, cb) {
          chunks.push(chunk.toString())
          cb()
        },
      })

      const logger = createLogger('api', stream)
      logger.info('test message')

      expect(chunks.length).toBeGreaterThan(0)
      const line = chunks[0]?.trim()
      expect(line).toBeDefined()
      const parsed = JSON.parse(line!) as { name?: string; msg?: string }
      expect(parsed.name).toBe('api')
      expect(parsed.msg).toBe('test message')
    })
  })
})
