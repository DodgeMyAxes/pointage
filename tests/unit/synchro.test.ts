import { describe, expect, it, vi } from 'vitest'
import { MARGE_RELECTURE, ajouterEvenement, synchroniser } from '../../src/lib/synchro'
import { donnees } from '../aides'

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
