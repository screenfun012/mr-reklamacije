import { describe, expect, it } from 'vitest'

import { IntakeVehicleType } from '../../enums.js'
import { intakeDamageZoneOf } from '../intake-damage-zones.js'

/**
 * These pin the prototype's thresholds. If a refactor "tidies" them, the zone printed on a
 * signed work order silently changes — and the zone is what the customer reads.
 */
describe('intakeDamageZoneOf', () => {
  it('reads a car top to bottom, front at the bottom', () => {
    const car = IntakeVehicleType.Car
    expect(intakeDamageZoneOf(car, 170, 40)).toBe('zadnji branik')
    expect(intakeDamageZoneOf(car, 170, 90)).toBe('gepek / poklopac')
    expect(intakeDamageZoneOf(car, 170, 120)).toBe('zadnje staklo')
    expect(intakeDamageZoneOf(car, 170, 300)).toBe('krov')
    expect(intakeDamageZoneOf(car, 170, 390)).toBe('vetrobran')
    expect(intakeDamageZoneOf(car, 170, 450)).toBe('hauba')
    expect(intakeDamageZoneOf(car, 170, 500)).toBe('prednji branik')
  })

  it('splits a car sideways at y=270', () => {
    const car = IntakeVehicleType.Car
    expect(intakeDamageZoneOf(car, 60, 200)).toBe('zadnja leva strana')
    expect(intakeDamageZoneOf(car, 60, 300)).toBe('prednja leva strana')
    expect(intakeDamageZoneOf(car, 300, 200)).toBe('zadnja desna strana')
    expect(intakeDamageZoneOf(car, 300, 300)).toBe('prednja desna strana')
  })

  it('gives a kombi no boot, and names its cargo half', () => {
    const van = IntakeVehicleType.Van
    expect(intakeDamageZoneOf(van, 170, 50)).toBe('zadnja vrata')
    expect(intakeDamageZoneOf(van, 60, 200)).toBe('leva bočna strana (teretni deo)')
    expect(intakeDamageZoneOf(van, 60, 350)).toBe('leva bočna strana (kabina)')
    expect(intakeDamageZoneOf(van, 170, 300)).toBe('krov teretnog dela')
    expect(intakeDamageZoneOf(van, 170, 420)).toBe('vetrobran')
    // A car would call this spot the boot lid; a kombi must never say "gepek".
    expect(intakeDamageZoneOf(van, 170, 90)).not.toContain('gepek')
  })

  it('splits a kamionet into bed and cab', () => {
    const pickup = IntakeVehicleType.Pickup
    expect(intakeDamageZoneOf(pickup, 170, 50)).toBe('zadnji branik')
    expect(intakeDamageZoneOf(pickup, 60, 200)).toBe('leva strana sanduka')
    expect(intakeDamageZoneOf(pickup, 60, 350)).toBe('leva strana kabine')
    expect(intakeDamageZoneOf(pickup, 170, 250)).toBe('sanduk (korito)')
    expect(intakeDamageZoneOf(pickup, 170, 300)).toBe('zadnje staklo kabine')
    expect(intakeDamageZoneOf(pickup, 170, 350)).toBe('krov kabine')
  })

  it('uses the džip its own side boundaries, which are not the car ones', () => {
    const suv = IntakeVehicleType.Suv
    // 98/242 for a džip, 100/240 elsewhere — x=99 is a side on a car but the roof line here.
    expect(intakeDamageZoneOf(suv, 99, 200)).not.toContain('leva')
    expect(intakeDamageZoneOf(IntakeVehicleType.Car, 99, 200)).toBe('zadnja leva strana')
    expect(intakeDamageZoneOf(suv, 170, 100)).toBe('zadnja vrata / gepek')
    expect(intakeDamageZoneOf(suv, 170, 250)).toBe('krov')
  })
})
