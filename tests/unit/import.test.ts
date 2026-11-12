import { describe, expect, it } from 'vitest'
import { calculerPeriode, transitions, calculerJour } from '../../src/lib/calcul'
import { donneesVides } from '../../src/lib/donnees'
import { exporterCsv, exporterTxt } from '../../src/lib/exports'
import { analyserImport, appliquerImport, cellulesCsv, lireDate, lireType } from '../../src/lib/import'
import { a, donnees, journeeType } from '../aides'

describe('lecture des dates et des types', () => {
  it('accepte les écritures courantes des dates', () => {
    expect(lireDate('02/11/2026')).toBe('2026-11-02')
    expect(lireDate('2/11/26')).toBe('2026-11-02')
    expect(lireDate('02-11-2026')).toBe('2026-11-02')
    expect(lireDate('02.11.2026')).toBe('2026-11-02')
    expect(lireDate('2026-11-02')).toBe('2026-11-02')
    expect(lireDate('31/02/2026')).toBeNull()
    expect(lireDate('11/2026')).toBeNull()
  })

  it('reconnaît les types avec ou sans accents', () => {
    expect(lireType('Congé')).toBe('conge')
    expect(lireType('conges')).toBe('conge')
    expect(lireType('FÉRIÉ')).toBe('ferie')
    expect(lireType('Récupération')).toBe('recup')
    expect(lireType('Demi-journée')).toBe('demi')
    expect(lireType('maladie')).toBe('absence')
    expect(lireType('réunion')).toBeUndefined()
  })
})

describe('import texte', () => {
  it('lit quatre heures, deux heures, un type et une note', () => {
    const { format, jours, refus } = analyserImport([
      '# mes heures',
      '02/11/2026 9:30 12:00 13:55 17:10',
      '',
      '03/11/2026 8h45 17h30',
      '04/11/2026 congé',
      '05/11/2026 8:30 12:15 13:30 16:50 Formation  sécurité',
      '06/11/2026 récupération Pont du 11',
    ].join('\n'))
    expect(format).toBe('texte')
    expect(refus).toEqual([])
    expect(jours.map((j) => [j.cle, j.modif])).toEqual([
      ['2026-11-02', { arrivee: '09:30', pause: '12:00', reprise: '13:55', depart: '17:10' }],
      ['2026-11-03', { arrivee: '08:45', pause: '', reprise: '', depart: '17:30' }],
      ['2026-11-04', { type: 'conge' }],
      ['2026-11-05', { arrivee: '08:30', pause: '12:15', reprise: '13:30', depart: '16:50', note: 'Formation  sécurité' }],
      ['2026-11-06', { type: 'recup', note: 'Pont du 11' }],
    ])
  })

  it('refuse les lignes fausses avec leur numéro et la raison, et garde les autres', () => {
    const { jours, refus } = analyserImport([
      '02/11/2026 9:30 12:00 13:55 17:10',
      '31/02/2026 9:00 17:00',
      '03/11/2026 9:00 12:00 17:00',
      '04/11/2026 17:00 9:00',
      '05/11/2026 9:3O 17:00',
      '06/11/2026',
      '02/11/2026 8:00 16:00',
    ].join('\r\n'))
    expect(jours.map((j) => j.cle)).toEqual(['2026-11-02'])
    expect(refus.map((r) => [r.ligne, r.raison])).toEqual([
      [2, 'date invalide « 31/02/2026 » (attendu : JJ/MM/AAAA)'],
      [3, '3 heures : il en faut 2 (arrivée, départ) ou 4 (arrivée, pause, reprise, départ)'],
      [4, 'heures dans le désordre'],
      [5, 'heure invalide « 9:3O »'],
      [6, 'ni heure, ni type, ni note'],
      [7, 'jour déjà présent ligne 1'],
    ])
  })
})

describe('import CSV', () => {
  it('relit l’export CSV de Pointage', () => {
    const d = donnees(journeeType('2026-11-09'), {
      '2026-11-09': { matin: 'Projet A', apresMidi: 'Réunions' },
      '2026-11-10': { type: 'conge', note: 'Pont; "long"' },
    })
    const csv = exporterCsv(calculerPeriode(d, '2026-11-09', '2026-11-10', a('2026-11-12', '10:00')))
    const { format, jours, refus } = analyserImport(csv)
    expect(format).toBe('csv')
    expect(refus).toEqual([])
    expect(jours.map((j) => [j.cle, j.modif])).toEqual([
      ['2026-11-09', { arrivee: '08:10', pause: '12:03', reprise: '13:31', depart: '16:58', type: 'travail', matin: 'Projet A', apresMidi: 'Réunions' }],
      ['2026-11-10', { type: 'conge', note: 'Pont; "long"' }],
    ])
  })

  it('trouve les colonnes par leur nom, quel que soit le séparateur', () => {
    const { jours, refus } = analyserImport('Note,Départ,Arrivée,Date\nRDV,17:00,9:00,02/11/2026\n,,,pas une date')
    expect(jours).toEqual([{ ligne: 2, cle: '2026-11-02', modif: { arrivee: '09:00', depart: '17:00', pause: '', reprise: '', note: 'RDV' } }])
    expect(refus[0].raison).toBe('date invalide « pas une date » (attendu : JJ/MM/AAAA)')
  })

  it('refuse un type inconnu et une pause sans reprise', () => {
    const { refus } = analyserImport('Date;Arrivée;Pause;Reprise;Départ;Type\n02/11/2026;9:00;12:00;;17:00;\n03/11/2026;;;;;vacances au ski')
    expect(refus.map((r) => r.raison)).toEqual(['pause sans reprise (ou l’inverse)', 'type de jour inconnu « vacances au ski »'])
  })

  it('découpe les cellules entre guillemets', () => {
    expect(cellulesCsv('a;"b;c";"d ""e"""', ';')).toEqual(['a', 'b;c', 'd "e"'])
  })
})

describe('application et aller-retour', () => {
  it('importe tout d’un coup sous forme de corrections manuelles', () => {
    const { jours } = analyserImport('02/11/2026 9:30 12:00 13:55 17:10\n03/11/2026 8:45 17:30\n04/11/2026 congé')
    const d = appliquerImport(donneesVides(), jours)
    expect(d.saisies).toEqual({
      '2026-11-02': { arrivee: '09:30', pause: '12:00', reprise: '13:55', depart: '17:10' },
      '2026-11-03': { arrivee: '08:45', pause: '', reprise: '', depart: '17:30' },
      '2026-11-04': { type: 'conge' },
    })
    const j = calculerJour('2026-11-02', transitions([]), d, a('2026-11-20', '10:00'))
    expect(j.travaille).toBe(150 + 195)
  })

  it('exporte en texte ce que l’import sait relire', () => {
    const d = donnees(journeeType('2026-11-09'), {
      '2026-11-10': { type: 'conge', note: 'Pont' },
      '2026-11-12': { arrivee: '08:00', depart: '16:00', pause: '', reprise: '' },
    })
    const jours = calculerPeriode(d, '2026-11-09', '2026-11-13', a('2026-11-14', '10:00'))
    const txt = exporterTxt(jours)
    expect(txt.split('\r\n')).toEqual([
      '# Pointage : date, arrivée, pause, reprise, départ, puis type et note éventuels',
      '09/11/2026 08:10 12:03 13:31 16:58',
      '10/11/2026 congé Pont',
      '12/11/2026 08:00 16:00',
      '',
    ])
    expect(appliquerImport(donneesVides(), analyserImport(txt).jours).saisies['2026-11-10']).toEqual({ type: 'conge', note: 'Pont' })
  })
})
