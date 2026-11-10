import { describe, expect, it } from 'vitest'
import {
  REGLAGES_PAR_DEFAUT, appliquerReglages, appliquerSaisie, donneesPremierLancement, donneesVides, normaliser,
  typeParDefaut,
} from '../../src/lib/donnees'

describe('normaliser', () => {
  it('repart des valeurs par défaut pour une entrée illisible', () => {
    expect(normaliser(null)).toEqual(donneesVides())
    expect(normaliser('texte')).toEqual(donneesVides())
  })

  it('garde ce qui est valide et écarte le reste', () => {
    const d = normaliser({
      evenements: [{ t: 2, nature: 'veille' }, { t: 1, nature: 'ouverture' }, { t: 'x', nature: 'veille' }, { t: 3, nature: 'inconnue' }],
      saisies: {
        '2026-11-09': { arrivee: '8h05', pause: '', depart: '99:00', type: 'conge', note: '  RDV  ' },
        'pas-une-date': { arrivee: '08:00' },
        '2026-11-10': { depart: 'n’importe quoi' },
      },
      reglages: { objectif: 420, pauseDebut: '14:00', pauseFin: '12:00', notifier: false },
      derniereLecture: 123,
      derniereRechercheMaj: 456,
    })
    expect(d.evenements).toEqual([{ t: 1, nature: 'ouverture' }, { t: 2, nature: 'veille' }])
    expect(d.saisies).toEqual({ '2026-11-09': { arrivee: '08:05', pause: '', type: 'conge', note: 'RDV' } })
    expect(d.reglages.objectif).toBe(420)
    expect(d.reglages.pauseDebut).toBe(REGLAGES_PAR_DEFAUT.pauseDebut)
    expect(d.reglages.notifier).toBe(false)
    expect(d.derniereLecture).toBe(123)
    expect(d.derniereRechercheMaj).toBe(456)
  })
})

describe('premier lancement', () => {
  it('fait commencer le décompte au lundi de la semaine', () => {
    expect(donneesPremierLancement(new Date(2026, 10, 12, 9).getTime()).reglages.dateDebut).toBe('2026-11-09')
    expect(donneesPremierLancement(new Date(2026, 10, 9, 2).getTime()).reglages.dateDebut).toBe('2026-11-02')
  })
})

describe('appliquerSaisie', () => {
  const LUNDI = '2026-11-09'

  it('enregistre, vide et rétablit une heure', () => {
    let d = appliquerSaisie(donneesVides(), LUNDI, { arrivee: '8:05', pause: '' })
    expect(d.saisies[LUNDI]).toEqual({ arrivee: '08:05', pause: '' })
    d = appliquerSaisie(d, LUNDI, { arrivee: null, pause: null })
    expect(d.saisies[LUNDI]).toBeUndefined()
  })

  it('nomme le jour et le champ dans l’erreur', () => {
    expect(() => appliquerSaisie(donneesVides(), LUNDI, { depart: '25:00' }))
      .toThrow('Heure de départ invalide pour le lundi 9 novembre : « 25:00 ».')
  })

  it('n’enregistre pas un type égal au type par défaut', () => {
    const d = appliquerSaisie(donneesVides(), LUNDI, { type: 'conge' })
    expect(d.saisies[LUNDI]).toEqual({ type: 'conge' })
    expect(appliquerSaisie(d, LUNDI, { type: 'travail' }).saisies[LUNDI]).toBeUndefined()
    expect(() => appliquerSaisie(d, LUNDI, { type: 'vacances' })).toThrow('Type de jour inconnu')
  })

  it('enregistre et efface une note', () => {
    const d = appliquerSaisie(donneesVides(), LUNDI, { note: ' Médecin ' })
    expect(d.saisies[LUNDI].note).toBe('Médecin')
    expect(appliquerSaisie(d, LUNDI, { note: '' }).saisies[LUNDI]).toBeUndefined()
  })

  it('ne modifie pas les données d’origine', () => {
    const d = donneesVides()
    appliquerSaisie(d, LUNDI, { arrivee: '08:00' })
    expect(d.saisies).toEqual({})
  })
})

describe('appliquerReglages', () => {
  it('valide et normalise', () => {
    const d = appliquerReglages(donneesVides(), { pauseDebut: '11:30', joursTravailles: [5, 1, 1, 3] })
    expect(d.reglages.pauseDebut).toBe('11:30')
    expect(d.reglages.joursTravailles).toEqual([1, 3, 5])
  })

  it('accepte les trois thèmes et refuse les autres', () => {
    expect(appliquerReglages(donneesVides(), { theme: 'sombre' }).reglages.theme).toBe('sombre')
    expect(() => appliquerReglages(donneesVides(), { theme: 'noir' as never })).toThrow('Thème inconnu : « noir ».')
    expect(normaliser({ reglages: { theme: 'noir' } }).reglages.theme).toBe('systeme')
  })

  it('refuse une plage de pause à l’envers', () => {
    expect(() => appliquerReglages(donneesVides(), { pauseDebut: '15:30' }))
      .toThrow('La plage de pause doit finir après son début (15:30 – 15:00).')
  })

  it('refuse un objectif nul et une date invalide', () => {
    expect(() => appliquerReglages(donneesVides(), { objectif: 0 })).toThrow('Durée quotidienne invalide')
    expect(() => appliquerReglages(donneesVides(), { dateDebut: '2026-13-01' })).toThrow('Date de début invalide')
  })

  it('tient compte des jours travaillés pour le type par défaut', () => {
    const d = appliquerReglages(donneesVides(), { joursTravailles: [1, 2, 3, 4] })
    expect(typeParDefaut('2026-11-13', d.reglages)).toBe('repos')
    expect(typeParDefaut('2026-11-12', d.reglages)).toBe('travail')
  })
})
