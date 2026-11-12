import { describe, expect, it, vi } from 'vitest'
import { MARGE_RELECTURE, ajouterEvenement, synchroniser } from '../../src/lib/synchro'
import { fusionner } from '../../src/lib/evenements'
import { a, donnees, ev } from '../aides'

describe('synchroniser', () => {
  it('lit tout le journal la première fois, puis seulement depuis la dernière lecture', async () => {
    const lire = vi.fn().mockResolvedValue([{ t: 10, nature: 'ouverture' }])
    const premiere = await synchroniser(donnees(), lire, 1_000)
    expect(lire).toHaveBeenLastCalledWith(undefined)
    expect(premiere.derniereLecture).toBe(1_000)

    lire.mockResolvedValue([{ t: 10, nature: 'ouverture' }, { t: 20, nature: 'veille' }])
    const seconde = await synchroniser(premiere, lire, 5_000)
    expect(lire).toHaveBeenLastCalledWith(1_000 - MARGE_RELECTURE)
    expect(seconde.evenements).toEqual([{ t: 10, nature: 'ouverture' }, { t: 20, nature: 'veille' }])
  })

  it('garde les événements que le journal Windows a effacés depuis', async () => {
    const d = { ...donnees([{ t: 1, nature: 'ouverture' }]), derniereLecture: 100 }
    const resultat = await synchroniser(d, async () => [{ t: 50, nature: 'veille' }], 200)
    expect(resultat.evenements.map((e) => e.t)).toEqual([1, 50])
  })

  it('laisse les données intactes si la lecture échoue', async () => {
    const d = donnees()
    await expect(synchroniser(d, async () => { throw new Error('refus') }, 1)).rejects.toThrow('refus')
    expect(d.derniereLecture).toBeUndefined()
  })
})

describe('ajouterEvenement', () => {
  it('ajoute sans doublon', () => {
    const d = ajouterEvenement(ajouterEvenement(donnees(), 'verrouillage', 5), 'verrouillage', 5)
    expect(d.evenements).toEqual([{ t: 5, nature: 'verrouillage' }])
  })
})

describe('fusionner', () => {
  const J = '2026-11-12'

  it('écarte un même événement signalé deux fois de suite à moins de deux minutes', () => {
    const res = fusionner(
      [ev(J, '10:56:03', 'deverrouillage'), ev(J, '10:56:40', 'deverrouillage'), ev(J, '08:00:00', 'demarrage')],
      [ev(J, '08:00:01', 'demarrage'), ev(J, '10:56:03', 'deverrouillage')],
    )
    expect(res).toEqual([ev(J, '08:00:00', 'demarrage'), ev(J, '10:56:03', 'deverrouillage')])
  })

  it('garde les répétitions espacées ou séparées par un autre événement', () => {
    const liste = [
      ev(J, '10:00:00', 'deverrouillage'), ev(J, '10:00:30', 'verrouillage'), ev(J, '10:01:00', 'deverrouillage'),
      ev(J, '12:00:00', 'veille'), ev(J, '12:05:00', 'veille'),
    ]
    expect(fusionner(liste)).toEqual(liste)
  })

  it('donne le même résultat relu plusieurs fois', () => {
    const une = fusionner([ev(J, '09:00:00', 'reveil'), ev(J, '09:01:00', 'reveil'), ev(J, '09:02:30', 'reveil')])
    expect(une).toEqual([ev(J, '09:00:00', 'reveil'), ev(J, '09:02:30', 'reveil')])
    expect(fusionner(une, [ev(J, '09:01:00', 'reveil')])).toEqual(une)
    expect(a(J, '09:00')).toBe(une[0].t)
  })
})
