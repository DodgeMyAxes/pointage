import { describe, expect, it } from 'vitest'
import { joursFeries, nomFerie, paques } from '../../src/lib/feries'

describe('jours fériés', () => {
  it('calcule Pâques', () => {
    expect(paques(2026)).toBe('2026-04-05')
    expect(paques(2027)).toBe('2027-03-28')
    expect(paques(2038)).toBe('2038-04-25')
  })

  it('déduit les fêtes mobiles de Pâques', () => {
    expect(nomFerie('2026-04-06')).toBe('Lundi de Pâques')
    expect(nomFerie('2026-05-14')).toBe('Ascension')
    expect(nomFerie('2026-05-25')).toBe('Lundi de Pentecôte')
  })

  it('compte onze jours fériés par an', () => {
    expect(joursFeries(2026).size).toBe(11)
    expect(nomFerie('2026-11-11')).toBe('Armistice 1918')
    expect(nomFerie('2026-11-10')).toBeUndefined()
  })
})
