import { describe, expect, it } from 'vitest'
import {
  ajouterMois, cleJourneeDe, ecrireHeure, formatDuree, instant, joursDuMois, jourSemaine, lireDuree, lireHeure,
  lundiDe, nomJourCourt, nomJourLong, nomMois, numeroSemaine, estCleJour,
} from '../../src/lib/temps'
import { a } from '../aides'

describe('durées', () => {
  it('formate avec deux chiffres pour les minutes et un signe si demandé', () => {
    expect(formatDuree(442)).toBe('7h22')
    expect(formatDuree(5)).toBe('0h05')
    expect(formatDuree(15, true)).toBe('+0h15')
    expect(formatDuree(-63, true)).toBe('-1h03')
    expect(formatDuree(0, true)).toBe('+0h00')
  })

  it('lit les formats usuels et refuse le reste', () => {
    expect(lireDuree('7h22')).toBe(442)
    expect(lireDuree('7:22')).toBe(442)
    expect(lireDuree('+3h15')).toBe(195)
    expect(lireDuree('-1h03')).toBe(-63)
    expect(lireDuree('−0h30')).toBe(-30)
    expect(lireDuree('2')).toBe(120)
    expect(lireDuree('7h75')).toBeNull()
    expect(lireDuree('abc')).toBeNull()
  })
})

describe('heures', () => {
  it('lit « 8:05 », « 08:05 », « 8h05 », « 8h »', () => {
    expect(lireHeure('8:05')).toBe(485)
    expect(lireHeure('08:05')).toBe(485)
    expect(lireHeure('8h05')).toBe(485)
    expect(lireHeure('8h')).toBe(480)
    expect(lireHeure('24:00')).toBeNull()
    expect(lireHeure('12:60')).toBeNull()
    expect(lireHeure('')).toBeNull()
  })

  it('écrit sur deux chiffres', () => {
    expect(ecrireHeure(485)).toBe('08:05')
  })

  it('place une heure locale correctement un jour de changement d’heure', () => {
    expect(new Date(instant('2026-03-29', 9 * 60)).getHours()).toBe(9)
    expect(new Date(instant('2026-10-25', 9 * 60)).getHours()).toBe(9)
  })
})

describe('jours', () => {
  it('rattache la nuit avant 4 h à la veille', () => {
    expect(cleJourneeDe(a('2026-11-10', '03:59'))).toBe('2026-11-09')
    expect(cleJourneeDe(a('2026-11-10', '04:00'))).toBe('2026-11-10')
  })

  it('numérote les semaines selon ISO 8601', () => {
    expect(numeroSemaine('2026-01-01')).toBe(1)
    expect(numeroSemaine('2026-11-09')).toBe(46)
    expect(numeroSemaine('2026-12-31')).toBe(53)
    expect(numeroSemaine('2027-01-03')).toBe(53)
  })

  it('calcule le jour de la semaine et le lundi', () => {
    expect(jourSemaine('2026-11-15')).toBe(7)
    expect(lundiDe('2026-11-15')).toBe('2026-11-09')
  })

  it('nomme les jours et les mois en français', () => {
    expect(nomJourCourt('2026-11-09')).toBe('lun. 09/11')
    expect(nomJourLong('2026-12-01')).toBe('mardi 1er décembre')
    expect(nomMois('2026-08')).toBe('août 2026')
  })

  it('parcourt les mois', () => {
    expect(ajouterMois('2026-12', 1)).toBe('2027-01')
    expect(ajouterMois('2026-01', -1)).toBe('2025-12')
    expect(joursDuMois('2028-02')).toHaveLength(29)
  })

  it('valide les clés de jour', () => {
    expect(estCleJour('2026-02-28')).toBe(true)
    expect(estCleJour('2026-02-30')).toBe(false)
    expect(estCleJour('2026-2-3')).toBe(false)
  })
})
