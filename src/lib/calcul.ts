/**
 * Des événements bruts aux journées :
 * 1. les événements deviennent des transitions présent/absent (`transitions`) ;
 * 2. pour chaque journée (de 4 h à 4 h), `detecter` retient l'arrivée (première présence), le départ
 *    (dernière absence non suivie d'un retour), et la pause : la plus longue absence qui touche la plage
 *    de midi et dure au moins la pause minimale ;
 * 3. `calculerJour` y superpose les corrections manuelles et calcule le temps travaillé :
 *    (pause − arrivée) + (départ − reprise). Les autres absences de la journée ne sont pas décomptées.
 */
import {
  CHAMPS, attenduPour, typeParDefaut,
  type Champ, type Donnees, type Reglages, type TypeJour,
} from './donnees'
import { ALLUME, type Evenement } from './evenements'
import { nomFerie } from './feries'
import {
  DEBUT_JOURNEE, MINUTE, ajouterJours, cleJourneeDe, instant, lireHeure, plageJours, tronquerMinute,
} from './temps'

/** Un démarrage n'est retenu que s'il est suivi d'une ouverture de session : sinon c'est un redémarrage de nuit (mises à jour). */
const DELAI_OUVERTURE = 30 * MINUTE

export interface Transition {
  t: number
  present: boolean
}

export function transitions(evenements: readonly Evenement[]): Transition[] {
  const tries = [...evenements].sort((a, b) => a.t - b.t)
  const res: Transition[] = []
  let etat: boolean | undefined
  tries.forEach((e, i) => {
    if (e.nature === 'demarrage' && !ouvertureSuit(tries, i)) return
    const present = ALLUME.has(e.nature)
    if (present !== etat) {
      res.push({ t: tronquerMinute(e.t), present })
      etat = present
    }
  })
  return res
}

function ouvertureSuit(tries: readonly Evenement[], i: number): boolean {
  const limite = tries[i].t + DELAI_OUVERTURE
  for (let j = i + 1; j < tries.length && tries[j].t <= limite; j++) {
    if (tries[j].nature === 'ouverture') return true
    if (!ALLUME.has(tries[j].nature)) return false
  }
  return false
}

export interface Detection {
  arrivee?: number
  pause?: number
  reprise?: number
  depart?: number
  /** Présent à la dernière transition connue de la journée. */
  present: boolean
}

export function detecter(trans: readonly Transition[], cle: string, reglages: Reglages): Detection {
  const debut = instant(cle, DEBUT_JOURNEE)
  const fin = instant(ajouterJours(cle, 1), DEBUT_JOURNEE)
  const dans = trans.filter((x) => x.t >= debut && x.t < fin)
  const precedente = trans.findLast((x) => x.t < debut)
  const idxArrivee = dans.findIndex((x) => x.present)
  const suite = idxArrivee >= 0 ? dans.slice(idxArrivee) : dans
  const derniere = suite.at(-1)
  const present = derniere ? derniere.present : (precedente?.present ?? false)
  const res: Detection = { present }
  if (idxArrivee >= 0) res.arrivee = dans[idxArrivee].t
  if (derniere && !derniere.present) res.depart = derniere.t

  const plageDebut = instant(cle, lireHeure(reglages.pauseDebut) ?? 0)
  const plageFin = instant(cle, lireHeure(reglages.pauseFin) ?? 0)
  let meilleure: [number, number] | undefined
  for (let i = 0; i + 1 < suite.length; i++) {
    const [a, b] = [suite[i], suite[i + 1]]
    if (a.present || !b.present) continue
    if (b.t - a.t < reglages.pauseMin * MINUTE || b.t <= plageDebut || a.t >= plageFin) continue
    if (!meilleure || b.t - a.t > meilleure[1] - meilleure[0]) meilleure = [a.t, b.t]
  }
  if (meilleure) [res.pause, res.reprise] = meilleure
  return res
}

export type Statut = 'complet' | 'en-cours' | 'incomplet' | 'vide' | 'futur'

export interface Moment {
  t: number
  manuel: boolean
}

export interface Jour {
  cle: string
  type: TypeJour
  typeManuel: boolean
  ferie?: string
  note?: string
  matin?: string
  apresMidi?: string
  attendu: number
  arrivee?: Moment
  pause?: Moment
  reprise?: Moment
  depart?: Moment
  auto: Detection
  /** Champs vidés à la main. */
  vides: Champ[]
  /** Minutes travaillées (jusqu'à maintenant si la journée est en cours). */
  travaille: number | null
  ecart: number | null
  statut: Statut
  alerte?: string
  /** Entre dans le solde. */
  compte: boolean
}

const minutes = (ms: number) => Math.round(ms / MINUTE)

export function calculerJour(cle: string, trans: readonly Transition[], donnees: Donnees, maintenant: number): Jour {
  const { reglages } = donnees
  const saisie = donnees.saisies[cle] ?? {}
  const auto = detecter(trans, cle, reglages)
  const type = saisie.type ?? typeParDefaut(cle, reglages)
  const attendu = attenduPour(type, reglages)
  const jour: Jour = {
    cle, type, typeManuel: saisie.type !== undefined, ferie: nomFerie(cle), note: saisie.note, matin: saisie.matin, apresMidi: saisie.apresMidi,
    attendu, auto, vides: [], travaille: null, ecart: null, statut: 'vide', compte: false,
  }
  for (const champ of CHAMPS) {
    const valeur = saisie[champ]
    if (valeur === '') jour.vides.push(champ)
    else if (valeur !== undefined) {
      const min = lireHeure(valeur)
      if (min !== null) jour[champ] = { t: instant(cle, min), manuel: true }
    } else if (auto[champ] !== undefined) jour[champ] = { t: auto[champ], manuel: false }
  }

  const aujourdhui = cleJourneeDe(maintenant)
  if (cle > aujourdhui) {
    jour.statut = 'futur'
    return jour
  }
  const { arrivee, pause, reprise, depart } = jour
  const enCours = cle === aujourdhui && !depart && auto.present && saisie.depart === undefined
  const dansDecompte = !reglages.dateDebut || cle >= reglages.dateDebut

  if (!arrivee && !depart && !pause && !reprise) {
    // Rien de pointé : un jour non travaillé (congé, férié, récupération…) se compte tel quel,
    // un jour travaillé reste à renseigner.
    if (type !== 'travail' && type !== 'demi') {
      Object.assign(jour, { statut: 'complet', travaille: 0, ecart: 0 - attendu || 0, compte: dansDecompte })
    }
    return jour
  }
  if (!arrivee) return incomplet(jour, 'Arrivée manquante')
  const fin = depart?.t ?? (enCours ? Math.max(tronquerMinute(maintenant), arrivee.t) : undefined)
  if (fin === undefined) return incomplet(jour, 'Départ manquant')

  let travaille: number
  if (pause && reprise) {
    if (!(arrivee.t <= pause.t && pause.t <= reprise.t && reprise.t <= fin)) return incomplet(jour, 'Heures dans le désordre')
    travaille = minutes(pause.t - arrivee.t + fin - reprise.t)
  } else if (pause && enCours) {
    // Pause saisie à la main, reprise pas encore faite.
    if (pause.t < arrivee.t) return incomplet(jour, 'Heures dans le désordre')
    travaille = minutes(Math.min(pause.t, fin) - arrivee.t)
  } else if (pause || reprise) {
    return incomplet(jour, pause ? 'Reprise manquante' : 'Pause manquante')
  } else {
    if (fin < arrivee.t) return incomplet(jour, 'Heures dans le désordre')
    travaille = minutes(fin - arrivee.t)
    if (travaille > 6 * 60) jour.alerte = 'Pause non détectée'
  }
  jour.travaille = travaille
  jour.ecart = travaille - attendu
  jour.statut = enCours ? 'en-cours' : 'complet'
  jour.compte = !enCours && dansDecompte
  return jour
}

function incomplet(jour: Jour, alerte: string): Jour {
  return Object.assign(jour, { statut: 'incomplet' as const, alerte })
}

export interface Bilan {
  travaille: number
  attendu: number
  ecart: number
  jours: number
}

/** Somme des jours qui entrent dans le solde. */
export function bilan(jours: readonly Jour[]): Bilan {
  const res: Bilan = { travaille: 0, attendu: 0, ecart: 0, jours: 0 }
  for (const j of jours) {
    if (!j.compte) continue
    res.travaille += j.travaille ?? 0
    res.attendu += j.attendu
    res.ecart += j.ecart ?? 0
    res.jours++
  }
  return res
}

export interface Avancement extends Bilan {
  /** Temps fait sur la période, journée en cours comprise. */
  fait: number
  /** Temps attendu sur toute la période (jours à venir compris, fériés et congés déduits). */
  objectif: number
}

/**
 * Avancement d'une période (semaine, mois) : temps fait face à l'objectif de toute la période, et écart des
 * seuls jours terminés (celui qui entre dans le solde). Les jours d'avant le début du décompte sont ignorés.
 */
export function avancement(jours: readonly Jour[], dateDebut: string): Avancement {
  const res: Avancement = { ...bilan(jours), fait: 0, objectif: 0 }
  for (const j of jours) {
    if (dateDebut && j.cle < dateDebut) continue
    res.objectif += j.attendu
    if (j.compte || j.statut === 'en-cours') res.fait += j.travaille ?? 0
  }
  return res
}

export interface TempsActivite {
  /** Libellé tel que saisi la première fois ; undefined = demi-journées travaillées sans activité indiquée. */
  activite?: string
  minutes: number
  /** Demi-journées comptées. */
  demi: number
}

/**
 * Temps passé par activité : la matinée va de l'arrivée à la pause, l'après-midi du reste de la journée. Sans
 * pause, la journée entière va à l'activité indiquée, partagée en deux si les deux diffèrent. Les libellés sont
 * regroupés sans tenir compte de la casse ; le plus long temps d'abord, « sans activité » en dernier. Mêmes jours que
 * le temps « fait » de la période : ceux du décompte, journée en cours comprise.
 */
export function tempsParActivite(jours: readonly Jour[]): TempsActivite[] {
  const parCle = new Map<string, TempsActivite>()
  const ajouter = (activite: string | undefined, minutes: number, demi = 1) => {
    if (minutes <= 0) return
    const cle = activite?.toLocaleLowerCase('fr') ?? ''
    const t = parCle.get(cle) ?? { activite, minutes: 0, demi: 0 }
    t.minutes += minutes
    t.demi += demi
    parCle.set(cle, t)
  }
  for (const j of jours) {
    const total = j.travaille ?? 0
    if (total <= 0 || !(j.compte || j.statut === 'en-cours')) continue
    if (j.arrivee && j.pause) {
      const matin = Math.min(total, minutes(j.pause.t - j.arrivee.t))
      ajouter(j.matin, matin)
      ajouter(j.apresMidi, total - matin)
    } else if (j.matin && j.apresMidi && j.matin.toLocaleLowerCase('fr') !== j.apresMidi.toLocaleLowerCase('fr')) {
      const matin = Math.round(total / 2)
      ajouter(j.matin, matin)
      ajouter(j.apresMidi, total - matin)
    } else {
      ajouter(j.matin ?? j.apresMidi, total, 2)
    }
  }
  return [...parCle.values()].sort((a, b) =>
    a.activite === undefined ? 1 : b.activite === undefined ? -1 : b.minutes - a.minutes)
}

/** Premier jour connu : début du décompte, sinon premier événement ou première saisie. */
export function premierJour(donnees: Donnees): string | undefined {
  const candidats: string[] = Object.keys(donnees.saisies)
  if (donnees.evenements.length) candidats.push(cleJourneeDe(donnees.evenements[0].t))
  if (donnees.reglages.dateDebut) return donnees.reglages.dateDebut
  return candidats.sort()[0]
}

export function calculerPeriode(
  donnees: Donnees, de: string, a: string, maintenant: number, trans = transitions(donnees.evenements),
): Jour[] {
  return plageJours(de, a).map((cle) => calculerJour(cle, trans, donnees, maintenant))
}

/** Tous les jours du premier jour connu jusqu'à aujourd'hui. */
export function historique(donnees: Donnees, maintenant: number, trans = transitions(donnees.evenements)): Jour[] {
  const premier = premierJour(donnees)
  const aujourdhui = cleJourneeDe(maintenant)
  return premier && premier <= aujourdhui ? calculerPeriode(donnees, premier, aujourdhui, maintenant, trans) : []
}

/** Solde cumulé : solde de départ + écarts des journées terminées. */
export function solde(donnees: Donnees, jours: readonly Jour[]): number {
  return donnees.reglages.soldeInitial + bilan(jours).ecart
}

export interface Conseil {
  /** Heure de départ pour faire la durée attendue du jour. */
  objectif: number
  /** Heure de départ pour ramener le solde à zéro (si le solde n'est pas nul). */
  soldeZero?: number
}

/** Départ conseillé pour une journée en cours ; `soldeAvant` = solde sans cette journée. */
export function departConseille(jour: Jour, reglages: Reglages, soldeAvant: number, maintenant: number): Conseil | null {
  if (jour.statut !== 'en-cours' || !jour.arrivee) return null
  const { arrivee, pause, reprise } = jour
  let objectif: number
  if (pause && reprise) objectif = reprise.t + jour.attendu * MINUTE - (pause.t - arrivee.t)
  else if (pause) objectif = pause.t + reglages.pausePrevue * MINUTE + jour.attendu * MINUTE - (pause.t - arrivee.t)
  else {
    const plageFin = instant(jour.cle, lireHeure(reglages.pauseFin) ?? 0)
    const pauseAVenir = maintenant < plageFin ? reglages.pausePrevue : 0
    objectif = arrivee.t + (jour.attendu + pauseAVenir) * MINUTE
  }
  const conseil: Conseil = { objectif }
  if (soldeAvant !== 0) conseil.soldeZero = objectif - soldeAvant * MINUTE
  return conseil
}
