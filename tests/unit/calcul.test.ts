import { describe, expect, it } from 'vitest'
import {
  avancement, bilan, calculerJour, calculerPeriode, departConseille, historique, premierJour, solde, tempsParActivite, transitions,
} from '../../src/lib/calcul'
import { heureDe } from '../../src/lib/temps'
import { a, donnees, ev, journeeType } from '../aides'

const LUNDI = '2026-11-09'
const MARDI = '2026-11-10'
const APRES = a('2026-11-20', '12:00')

function jour(cle: string, d = donnees(), maintenant = APRES) {
  return calculerJour(cle, transitions(d.evenements), d, maintenant)
}

const heures = (j: ReturnType<typeof jour>) => ({
  arrivee: j.arrivee && heureDe(j.arrivee.t),
  pause: j.pause && heureDe(j.pause.t),
  reprise: j.reprise && heureDe(j.reprise.t),
  depart: j.depart && heureDe(j.depart.t),
})

describe('transitions', () => {
  it('compresse les suites d’événements de même sens et tronque à la minute', () => {
    const t = transitions(journeeType(LUNDI))
    expect(t.map((x) => [heureDe(x.t), x.present])).toEqual([
      ['08:10', true], ['12:03', false], ['13:31', true], ['16:58', false],
    ])
  })

  it('ignore un démarrage de nuit sans ouverture de session (mises à jour)', () => {
    const t = transitions([ev(LUNDI, '03:05', 'demarrage'), ev(LUNDI, '08:00', 'ouverture')])
    expect(t.map((x) => heureDe(x.t))).toEqual(['08:00'])
  })

  it('garde un démarrage suivi d’une ouverture de session dans la demi-heure', () => {
    const t = transitions([ev(LUNDI, '07:58', 'demarrage'), ev(LUNDI, '08:05', 'ouverture')])
    expect(t.map((x) => heureDe(x.t))).toEqual(['07:58'])
  })
})

describe('calculerJour : détection', () => {
  it('trouve les quatre heures d’une journée type et calcule le temps travaillé', () => {
    const j = jour(LUNDI, donnees(journeeType(LUNDI)))
    expect(heures(j)).toEqual({ arrivee: '08:10', pause: '12:03', reprise: '13:31', depart: '16:58' })
    expect(j.travaille).toBe(233 + 207)
    expect(j.attendu).toBe(442)
    expect(j.ecart).toBe(-2)
    expect(j.statut).toBe('complet')
    expect(j.compte).toBe(true)
  })

  it('ne prend pas un redémarrage du matin pour la pause', () => {
    const evts = [
      ...journeeType(LUNDI),
      ev(LUNDI, '10:00', 'arret'), ev(LUNDI, '10:02', 'demarrage'), ev(LUNDI, '10:03', 'ouverture'),
    ]
    expect(heures(jour(LUNDI, donnees(evts)))).toEqual({ arrivee: '08:10', pause: '12:03', reprise: '13:31', depart: '16:58' })
  })

  it('retient la plus longue absence de la plage de midi, si elle dure assez', () => {
    const evts = [
      ev(LUNDI, '08:00', 'ouverture'),
      ev(LUNDI, '11:30', 'verrouillage'), ev(LUNDI, '11:40', 'deverrouillage'), // 10 min : trop court
      ev(LUNDI, '12:10', 'veille'), ev(LUNDI, '13:20', 'reveil'),
      ev(LUNDI, '14:00', 'verrouillage'), ev(LUNDI, '14:30', 'deverrouillage'),
      ev(LUNDI, '17:00', 'arret'),
    ]
    expect(heures(jour(LUNDI, donnees(evts)))).toMatchObject({ pause: '12:10', reprise: '13:20' })
  })

  it('commence la pause au verrouillage même si la veille vient après', () => {
    const evts = [
      ev(LUNDI, '08:00', 'ouverture'),
      ev(LUNDI, '12:00', 'verrouillage'), ev(LUNDI, '12:20', 'veille'),
      ev(LUNDI, '13:25', 'reveil'), ev(LUNDI, '13:26', 'deverrouillage'),
      ev(LUNDI, '17:00', 'veille'),
    ]
    expect(heures(jour(LUNDI, donnees(evts)))).toEqual({ arrivee: '08:00', pause: '12:00', reprise: '13:25', depart: '17:00' })
  })

  it('signale une journée sans pause détectée', () => {
    const j = jour(LUNDI, donnees([ev(LUNDI, '08:00', 'ouverture'), ev(LUNDI, '16:00', 'arret')]))
    expect(j.travaille).toBe(480)
    expect(j.alerte).toBe('Pause non détectée')
    expect(j.statut).toBe('complet')
  })

  it('rattache un départ après minuit à la veille', () => {
    const j = jour(LUNDI, donnees([ev(LUNDI, '14:00', 'ouverture'), ev(MARDI, '00:30', 'veille')]))
    expect(heures(j)).toMatchObject({ arrivee: '14:00', depart: '00:30' })
    expect(j.travaille).toBe(10 * 60 + 30)
    expect(jour(MARDI, donnees([ev(LUNDI, '14:00', 'ouverture'), ev(MARDI, '00:30', 'veille')])).arrivee).toBeUndefined()
  })

  it('laisse incomplet un jour passé où le PC est resté allumé', () => {
    const j = jour(LUNDI, donnees([ev(LUNDI, '08:00', 'ouverture')]))
    expect(j.statut).toBe('incomplet')
    expect(j.alerte).toBe('Départ manquant')
    expect(j.compte).toBe(false)
  })

  it('calcule juste un jour de changement d’heure', () => {
    // 25 octobre 2026 : passage de 3 h à 2 h, avant le début de la journée de travail.
    const j = jour('2026-10-25', donnees(journeeType('2026-10-25', '08:00', '12:00', '13:00', '17:00')))
    expect(j.travaille).toBe(8 * 60)
  })
})

describe('calculerJour : corrections et types', () => {
  it('applique les heures corrigées à la main et les vidages', () => {
    const d = donnees(journeeType(LUNDI), { [LUNDI]: { arrivee: '07:50', pause: '', reprise: '' } })
    const j = jour(LUNDI, d)
    expect(j.arrivee).toEqual({ t: a(LUNDI, '07:50'), manuel: true })
    expect(j.pause).toBeUndefined()
    expect(j.vides).toEqual(['pause', 'reprise'])
    expect(j.travaille).toBe(9 * 60 + 8)
  })

  it('refuse des heures dans le désordre', () => {
    const j = jour(LUNDI, donnees(journeeType(LUNDI), { [LUNDI]: { reprise: '11:00' } }))
    expect(j.statut).toBe('incomplet')
    expect(j.alerte).toBe('Heures dans le désordre')
  })

  it('signale une pause sans reprise sur un jour passé', () => {
    const j = jour(LUNDI, donnees(journeeType(LUNDI), { [LUNDI]: { reprise: '' } }))
    expect(j.alerte).toBe('Reprise manquante')
  })

  it('compte un congé sans heures pour zéro et une récupération pour la journée entière', () => {
    const d = donnees([], { [LUNDI]: { type: 'conge' }, [MARDI]: { type: 'recup' } })
    expect(jour(LUNDI, d)).toMatchObject({ statut: 'complet', travaille: 0, ecart: 0, compte: true })
    expect(jour(MARDI, d)).toMatchObject({ statut: 'complet', travaille: 0, ecart: -442, compte: true })
  })

  it('laisse à renseigner un jour travaillé sans aucune heure, sans le compter', () => {
    expect(jour(LUNDI)).toMatchObject({ statut: 'vide', compte: false, travaille: null })
  })

  it('reconnaît les week-ends et les jours fériés', () => {
    expect(jour('2026-11-14')).toMatchObject({ type: 'repos', attendu: 0 })
    expect(jour('2026-11-11')).toMatchObject({ type: 'ferie', ferie: 'Armistice 1918', attendu: 0 })
  })

  it('compte en plus les heures faites un jour de repos', () => {
    const j = jour('2026-11-14', donnees([ev('2026-11-14', '09:00', 'ouverture'), ev('2026-11-14', '11:00', 'arret')]))
    expect(j.ecart).toBe(120)
  })

  it('donne une demi-journée attendue pour la moitié', () => {
    expect(jour(LUNDI, donnees([], { [LUNDI]: { type: 'demi' } })).attendu).toBe(221)
  })

  it('ne compte pas les jours avant le début du décompte', () => {
    const d = donnees(journeeType(LUNDI))
    d.reglages.dateDebut = MARDI
    expect(jour(LUNDI, d).compte).toBe(false)
  })
})

describe('journée en cours', () => {
  const MAINTENANT = a(MARDI, '10:30:40')

  it('compte jusqu’à maintenant sans entrer dans le solde', () => {
    const j = jour(MARDI, donnees([ev(MARDI, '08:00', 'ouverture')]), MAINTENANT)
    expect(j).toMatchObject({ statut: 'en-cours', travaille: 150, compte: false })
  })

  it('conseille l’heure de départ en tenant compte de la pause à venir et du solde', () => {
    const d = donnees([ev(MARDI, '08:00', 'ouverture')])
    const j = jour(MARDI, d, MAINTENANT)
    expect(heureDe(departConseille(j, d.reglages, 0, MAINTENANT)!.objectif)).toBe('16:22')
    const avecSolde = departConseille(j, d.reglages, 30, MAINTENANT)!
    expect(heureDe(avecSolde.soldeZero!)).toBe('15:52')
  })

  it('conseille d’après la pause réellement prise', () => {
    const d = donnees([ev(MARDI, '08:00', 'ouverture'), ev(MARDI, '12:00', 'veille'), ev(MARDI, '13:30', 'reveil')])
    const maintenant = a(MARDI, '14:00')
    const j = jour(MARDI, d, maintenant)
    expect(heureDe(departConseille(j, d.reglages, 0, maintenant)!.objectif)).toBe('16:52')
  })

  it('ne conseille rien pour une journée terminée', () => {
    const d = donnees(journeeType(LUNDI))
    expect(departConseille(jour(LUNDI, d), d.reglages, 0, APRES)).toBeNull()
  })

  it('ne présente pas les jours à venir comme manquants', () => {
    expect(jour('2026-11-30', donnees(), MAINTENANT).statut).toBe('futur')
  })
})

describe('bilans et solde', () => {
  it('additionne les jours comptés depuis le premier jour connu, report compris', () => {
    const d = donnees([...journeeType(LUNDI), ...journeeType(MARDI, '08:00', '12:00', '13:00', '17:00')])
    d.reglages.soldeInitial = 60
    const maintenant = a('2026-11-11', '10:00')
    expect(premierJour(d)).toBe(LUNDI)
    const jours = historique(d, maintenant)
    expect(jours.map((j) => j.cle)).toEqual([LUNDI, MARDI, '2026-11-11'])
    expect(bilan(jours)).toEqual({ travaille: 440 + 480, attendu: 884, ecart: -2 + 38, jours: 3 })
    expect(solde(d, jours)).toBe(60 + 36)
  })

  it('donne l’avancement d’une semaine sur son objectif complet, férié déduit', () => {
    const d = donnees([...journeeType(LUNDI), ev(MARDI, '08:00', 'ouverture')])
    const semaine = calculerPeriode(d, LUNDI, '2026-11-15', a(MARDI, '10:00'))
    // Lundi terminé (7h20), mardi en cours (2h00) ; mercredi 11 férié : 4 jours de 7h22.
    expect(avancement(semaine, '')).toEqual({ travaille: 440, attendu: 442, ecart: -2, jours: 1, fait: 560, objectif: 4 * 442 })
  })

  it('ignore dans l’avancement les jours d’avant le début du décompte', () => {
    const d = donnees(journeeType(LUNDI))
    d.reglages.dateDebut = MARDI
    const semaine = calculerPeriode(d, LUNDI, '2026-11-15', a('2026-11-16', '10:00'))
    // Lundi ignoré ; mardi, jeudi, vendredi attendus mais sans heure ; mercredi férié et week-end comptés pour zéro.
    expect(avancement(semaine, MARDI)).toMatchObject({ fait: 0, objectif: 3 * 442, jours: 3, ecart: 0 })
  })

  it('calcule une période quelconque', () => {
    expect(calculerPeriode(donnees(), '2026-11-01', '2026-11-30', APRES)).toHaveLength(30)
  })
})

describe('temps par activité', () => {
  const periode = (d: ReturnType<typeof donnees>) => calculerPeriode(d, LUNDI, '2026-11-13', APRES, transitions(d.evenements))

  it('compte la matinée jusqu’à la pause et l’après-midi depuis la reprise, casse ignorée', () => {
    const d = donnees([...journeeType(LUNDI), ...journeeType(MARDI)], {
      [LUNDI]: { matin: 'Projet A', apresMidi: 'Réunions' },
      [MARDI]: { matin: 'projet a' },
    })
    expect(tempsParActivite(periode(d))).toEqual([
      { activite: 'Projet A', minutes: 2 * 233, demi: 2 },
      { activite: 'Réunions', minutes: 207, demi: 1 },
      { activite: undefined, minutes: 207, demi: 1 },
    ])
  })

  it('partage une journée sans pause entre deux activités, ou la donne entière à une seule', () => {
    const sansPause = { arrivee: '09:00', pause: '', reprise: '', depart: '17:00' }
    const d = donnees([], {
      [LUNDI]: { ...sansPause, matin: 'A', apresMidi: 'B' },
      [MARDI]: { ...sansPause, apresMidi: 'B' },
    })
    expect(tempsParActivite(periode(d))).toEqual([
      { activite: 'B', minutes: 240 + 480, demi: 3 },
      { activite: 'A', minutes: 240, demi: 1 },
    ])
  })
})
