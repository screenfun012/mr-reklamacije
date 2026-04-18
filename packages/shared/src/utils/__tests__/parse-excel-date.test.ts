import { describe, expect, it } from 'vitest'

import { parseExcelDate } from '../parse-excel-date.js'

describe('parseExcelDate', () => {
  describe('null/empty inputs', () => {
    it('returns null for null', () => {
      expect(parseExcelDate(null)).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(parseExcelDate(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseExcelDate('')).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
      expect(parseExcelDate('   ')).toBeNull()
      expect(parseExcelDate('\t\n  \r')).toBeNull()
    })
  })

  describe('Date objects pass-through', () => {
    it('returns the same Date reference unchanged', () => {
      const d = new Date(2025, 5, 15, 14, 30, 0, 0)
      expect(parseExcelDate(d)).toBe(d)
    })
  })

  describe('Excel serial numbers', () => {
    it('converts serial 44927 to January 1, 2023 (Microsoft reference)', () => {
      const result = parseExcelDate(44927)
      expect(result).not.toBeNull()
      expect(result!.getFullYear()).toBe(2023)
      expect(result!.getMonth()).toBe(0)
      expect(result!.getDate()).toBe(1)
    })

    it('converts serial 42736 to January 1, 2017', () => {
      const result = parseExcelDate(42736)
      expect(result).not.toBeNull()
      expect(result!.getFullYear()).toBe(2017)
      expect(result!.getMonth()).toBe(0)
      expect(result!.getDate()).toBe(1)
    })

    it('converts serial 40729 to July 5, 2011', () => {
      const result = parseExcelDate(40729)
      expect(result).not.toBeNull()
      expect(result!.getFullYear()).toBe(2011)
      expect(result!.getMonth()).toBe(6)
      expect(result!.getDate()).toBe(5)
    })

    it('converts serial 39448 to January 1, 2008 (Microsoft reference)', () => {
      const result = parseExcelDate(39448)
      expect(result).not.toBeNull()
      expect(result!.getFullYear()).toBe(2008)
      expect(result!.getMonth()).toBe(0)
      expect(result!.getDate()).toBe(1)
    })

    it('returns a valid Date for serial 1 (Excel epoch edge)', () => {
      const result = parseExcelDate(1)
      expect(result).not.toBeNull()
      expect(result).toBeInstanceOf(Date)
      expect(Number.isFinite(result!.getTime())).toBe(true)
    })

    it('truncates decimal serial to whole day (January 1, 2023 from 44927.7)', () => {
      const result = parseExcelDate(44927.7)
      expect(result).not.toBeNull()
      expect(result!.getFullYear()).toBe(2023)
      expect(result!.getMonth()).toBe(0)
      expect(result!.getDate()).toBe(1)
    })

    it('returns null for serial zero', () => {
      expect(parseExcelDate(0)).toBeNull()
    })

    it('returns null for negative serial', () => {
      expect(parseExcelDate(-1)).toBeNull()
      expect(parseExcelDate(-45383)).toBeNull()
    })

    it('returns null for NaN', () => {
      expect(parseExcelDate(Number.NaN)).toBeNull()
    })

    it('returns null for Infinity', () => {
      expect(parseExcelDate(Number.POSITIVE_INFINITY)).toBeNull()
      expect(parseExcelDate(Number.NEGATIVE_INFINITY)).toBeNull()
    })
  })

  describe('European format DD.MM.YYYY', () => {
    it('parses DD.MM.YYYY without trailing dot', () => {
      expect(parseExcelDate('25.02.2025')).toEqual(new Date(2025, 1, 25))
    })

    it('parses DD.MM.YYYY with trailing dot', () => {
      expect(parseExcelDate('25.02.2025.')).toEqual(new Date(2025, 1, 25))
    })

    it('parses localized spacing like 9. 2. 2026.', () => {
      expect(parseExcelDate('9. 2. 2026.')).toEqual(new Date(2026, 1, 9))
    })

    it('parses zero-padded day and month', () => {
      expect(parseExcelDate('01.01.2020')).toEqual(new Date(2020, 0, 1))
    })

    it('returns null when day is zero', () => {
      expect(parseExcelDate('0.1.2026')).toBeNull()
    })

    it('returns null when day exceeds 31', () => {
      expect(parseExcelDate('32.1.2026')).toBeNull()
    })

    it('returns null when day is invalid for month (rollover)', () => {
      expect(parseExcelDate('31.4.2026')).toBeNull()
    })
  })

  describe('US format M/D/YYYY', () => {
    it('parses M/D/YYYY', () => {
      expect(parseExcelDate('3/24/2026')).toEqual(new Date(2026, 2, 24))
    })

    it('parses 1/1/2026', () => {
      expect(parseExcelDate('1/1/2026')).toEqual(new Date(2026, 0, 1))
    })
  })

  describe('ambiguous dates', () => {
    it('treats first number > 12 as D/M/Y', () => {
      expect(parseExcelDate('13/5/2026')).toEqual(new Date(2026, 4, 13))
    })

    it('treats second number > 12 as M/D/Y', () => {
      expect(parseExcelDate('5/13/2026')).toEqual(new Date(2026, 4, 13))
    })

    it('uses M/D/Y when both parts are <= 12', () => {
      expect(parseExcelDate('3/5/2026')).toEqual(new Date(2026, 2, 5))
    })
  })

  describe('dash-separated format DD-MM-YYYY', () => {
    it('parses DD-MM-YYYY', () => {
      expect(parseExcelDate('25-02-2025')).toEqual(new Date(2025, 1, 25))
    })
  })

  describe('invalid inputs', () => {
    it('returns null for non-date string', () => {
      expect(parseExcelDate('not a date')).toBeNull()
    })

    it('returns null for impossible calendar date', () => {
      expect(parseExcelDate('32.13.2026')).toBeNull()
    })

    it('returns null when ISO-like month is out of range', () => {
      expect(parseExcelDate('2026-13-01')).toBeNull()
    })

    it('returns null for boolean', () => {
      expect(parseExcelDate(true)).toBeNull()
      expect(parseExcelDate(false)).toBeNull()
    })

    it('returns null for plain object', () => {
      expect(parseExcelDate({})).toBeNull()
    })
  })
})
