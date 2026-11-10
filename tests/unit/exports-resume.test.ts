import { describe, expect, it } from 'vitest'
import { calculerJour, calculerPeriode, transitions } from '../../src/lib/calcul'
import { exporterCsv } from '../../src/lib/exports'
import { journeeVientDEtreFaite, resumeDuJour, texteNotification } from '../../src/lib/resume'
import { a, donnees, ev, journeeType } from '../aides'

const LUNDI = '2026-11-09'

describe('export CSV', () => {
  it('écrit une ligne par jour passé, lisible par Excel', () => {
    const d = donnees(journeeType(LUNDI), { [LUNDI]: { note: 'Réunion; "client"' } })
    const csv = exporterCsv(calculerPeriode(d, LUNDI, '2026-11-12', a('2026-11-10', '12:00')))
    const lignes = csv.slice(1).trimEnd().split('\r\n')
    expect(csv.startsWith('﻿')).toBe(true)
    expect(lignes[0]).toBe('Date;Jour;Type;Arrivée;Pause;Reprise;Départ;Travaillé;Attendu;Écart;État;Note')
    expect(lignes[1]).toBe('09/11/2026;lun.;Travail;08:10;12:03;13:31;16:58;7h20;7h22;-0h02;;"Réunion; ""client"""')
    expect(lignes).toHaveLength(3) // les jours à venir ne sont pas exportés
  })
})

describe('résumé de la zone de notification', () => {
  it('donne l’arrivée, le temps fait et le départ conseillé', () => {
    const d = donnees([ev(LUNDI, '08:00', 'ouverture')])
    const maintenant = a(LUNDI, '10:00')
    const j = calculerJour(LUNDI, transitions(d.evenements), d, maintenant)
    expect(resumeDuJour(j, { objectif: a(LUNDI, '16:22') })).toBe('Pointage : Arrivée 08:00 · 2h00 faites · départ conseillé 16:22')
  })

  it('résume une journée terminée', () => {
    const d = donnees(journeeType(LUNDI))
    const j = calculerJour(LUNDI, transitions(d.evenements), d, a('2026-11-10', '09:00'))
    expect(resumeDuJour(j, null)).toBe('Pointage : Arrivée 08:10 · départ 16:58 · écart -0h02')
  })

  it('rédige la notification de journée faite', () => {
    const d = donnees([ev(LUNDI, '08:00', 'ouverture')])
    const j = calculerJour(LUNDI, transitions(d.evenements), d, a(LUNDI, '15:23'))
    expect(texteNotification(j)).toEqual({
      titre: 'Journée faite',
      corps: 'Vos 7h22 sont faites (arrivée à 08:00). Vous pouvez partir. Bonne fin de journée !',
    })
  })

  it('prévient seulement juste après avoir atteint le temps du jour', () => {
    const d = donnees([ev(LUNDI, '08:00', 'ouverture')])
    const t = transitions(d.evenements)
    expect(journeeVientDEtreFaite(calculerJour(LUNDI, t, d, a(LUNDI, '15:23')))).toBe(true)
    expect(journeeVientDEtreFaite(calculerJour(LUNDI, t, d, a(LUNDI, '15:21')))).toBe(false)
    expect(journeeVientDEtreFaite(calculerJour(LUNDI, t, d, a(LUNDI, '16:00')))).toBe(false)
  })
})
