/** Modèle des données enregistrées, valeurs par défaut, validation des modifications. */
import { estEvenement, fusionner, type Evenement } from './evenements'
import { nomFerie } from './feries'
import { cleJourneeDe, estCleJour, formatDuree, jourSemaine, lireHeure, lundiDe, nomJourLong } from './temps'

export const TYPES = ['travail', 'recup', 'demi', 'conge', 'ferie', 'absence', 'repos'] as const
export type TypeJour = (typeof TYPES)[number]

export const LIBELLES_TYPES: Record<TypeJour, string> = {
  travail: 'Travail',
  recup: 'Récupération',
  demi: 'Demi-journée',
  conge: 'Congé',
  ferie: 'Férié',
  absence: 'Absence',
  repos: 'Repos',
}

export const CHAMPS = ['arrivee', 'pause', 'reprise', 'depart'] as const
export type Champ = (typeof CHAMPS)[number]

export const LIBELLES_CHAMPS: Record<Champ, string> = {
  arrivee: 'arrivée',
  pause: 'pause',
  reprise: 'reprise',
  depart: 'départ',
}

/**
 * Corrections manuelles d'un jour. Une heure absente = valeur détectée ; « "" » = forcée à vide
 * (par exemple une pause détectée à tort).
 */
export interface Saisie {
  arrivee?: string
  pause?: string
  reprise?: string
  depart?: string
  type?: TypeJour
  note?: string
  /** Activités de la matinée et de l'après-midi (projet, tâche…). */
  matin?: string
  apresMidi?: string
}

/** Textes libres d'un jour, avec leur longueur maximale. */
export const TEXTES = { note: 200, matin: 100, apresMidi: 100 } as const
export type Texte = keyof typeof TEXTES

export interface Reglages {
  /** Durée quotidienne attendue, en minutes (7h22 = 442). */
  objectif: number
  /** Jours travaillés, 1 = lundi … 7 = dimanche. */
  joursTravailles: number[]
  /** Plage dans laquelle une absence est reconnue comme pause de midi. */
  pauseDebut: string
  pauseFin: string
  /** Durée minimale (minutes) d'une absence pour être reconnue comme pause. */
  pauseMin: number
  /** Durée de pause supposée (minutes) pour le départ conseillé, tant que la pause n'est pas prise. */
  pausePrevue: number
  /** Solde reporté d'avant l'application (minutes, signé). */
  soldeInitial: number
  /** Premier jour compté dans le solde (« » = depuis le premier jour connu). */
  dateDebut: string
  /** Prévenir quand la journée attendue est faite. */
  notifier: boolean
  /** Apparence : celle de Windows, ou forcée. */
  theme: Theme
  /** Rechercher une nouvelle version une fois par semaine, au premier démarrage du lundi (ou de la semaine). */
  majAuto: boolean
}

export const THEMES = ['systeme', 'clair', 'sombre'] as const
export type Theme = (typeof THEMES)[number]
export const LIBELLES_THEMES: Record<Theme, string> = { systeme: 'comme Windows', clair: 'clair', sombre: 'sombre' }
const estTheme = (v: unknown): v is Theme => (THEMES as readonly unknown[]).includes(v)

export interface Donnees {
  version: 1
  evenements: Evenement[]
  saisies: Record<string, Saisie>
  reglages: Reglages
  /** Instant de la dernière lecture réussie du journal Windows. */
  derniereLecture?: number
  /** Instant de la dernière recherche de mise à jour réussie (pour ne chercher qu'une fois par semaine). */
  derniereRechercheMaj?: number
}

export const REGLAGES_PAR_DEFAUT: Readonly<Reglages> = Object.freeze({
  objectif: 7 * 60 + 22,
  joursTravailles: [1, 2, 3, 4, 5],
  pauseDebut: '11:00',
  pauseFin: '15:00',
  pauseMin: 15,
  pausePrevue: 60,
  soldeInitial: 0,
  dateDebut: '',
  notifier: true,
  theme: 'systeme',
  majAuto: true,
})

export function donneesVides(): Donnees {
  return { version: 1, evenements: [], saisies: {}, reglages: { ...REGLAGES_PAR_DEFAUT, joursTravailles: [1, 2, 3, 4, 5] } }
}

/**
 * Données d'un premier lancement : le décompte commence au lundi de la semaine en cours. L'historique repris
 * du journal Windows reste visible, mais il n'a jamais été vérifié : il ne compte qu'à la demande (« Tout compter »).
 */
export function donneesPremierLancement(maintenant: number): Donnees {
  const d = donneesVides()
  d.reglages.dateDebut = lundiDe(cleJourneeDe(maintenant))
  return d
}

export function typeParDefaut(cle: string, reglages: Reglages): TypeJour {
  if (nomFerie(cle)) return 'ferie'
  return reglages.joursTravailles.includes(jourSemaine(cle)) ? 'travail' : 'repos'
}

export function attenduPour(type: TypeJour, reglages: Reglages): number {
  if (type === 'travail' || type === 'recup') return reglages.objectif
  if (type === 'demi') return Math.round(reglages.objectif / 2)
  return 0
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const estHeure = (v: unknown): v is string => typeof v === 'string' && (v === '' || lireHeure(v) !== null)
const estType = (v: unknown): v is TypeJour => (TYPES as readonly unknown[]).includes(v)
const entierEntre = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

function normaliserSaisie(brut: Record<string, unknown>): Saisie {
  const s: Saisie = {}
  for (const champ of CHAMPS) {
    const v = brut[champ]
    if (estHeure(v)) s[champ] = v === '' ? '' : normaliserHeure(v)
  }
  if (estType(brut.type)) s.type = brut.type
  for (const [champ, max] of Object.entries(TEXTES) as [Texte, number][]) {
    const v = brut[champ]
    if (typeof v === 'string' && v.trim()) s[champ] = v.trim().slice(0, max)
  }
  return s
}

function normaliserHeure(texte: string): string {
  const min = lireHeure(texte)!
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function normaliserReglages(brut: Record<string, unknown>): Reglages {
  const r: Reglages = { ...REGLAGES_PAR_DEFAUT, joursTravailles: [...REGLAGES_PAR_DEFAUT.joursTravailles] }
  if (entierEntre(brut.objectif, 1, 24 * 60)) r.objectif = brut.objectif
  if (Array.isArray(brut.joursTravailles) && brut.joursTravailles.every((j) => entierEntre(j, 1, 7))) {
    r.joursTravailles = [...new Set(brut.joursTravailles as number[])].sort()
  }
  if (estHeure(brut.pauseDebut) && brut.pauseDebut && estHeure(brut.pauseFin) && brut.pauseFin
    && lireHeure(brut.pauseDebut)! < lireHeure(brut.pauseFin)!) {
    r.pauseDebut = normaliserHeure(brut.pauseDebut)
    r.pauseFin = normaliserHeure(brut.pauseFin)
  }
  if (entierEntre(brut.pauseMin, 1, 240)) r.pauseMin = brut.pauseMin
  if (entierEntre(brut.pausePrevue, 0, 240)) r.pausePrevue = brut.pausePrevue
  if (entierEntre(brut.soldeInitial, -100_000, 100_000)) r.soldeInitial = brut.soldeInitial
  if (brut.dateDebut === '' || estCleJour(brut.dateDebut)) r.dateDebut = brut.dateDebut as string
  if (typeof brut.notifier === 'boolean') r.notifier = brut.notifier
  if (estTheme(brut.theme)) r.theme = brut.theme
  if (typeof brut.majAuto === 'boolean') r.majAuto = brut.majAuto
  return r
}

/** Relit des données d'origine inconnue (fichier, sauvegarde) en écartant tout ce qui est invalide. */
export function normaliser(brut: unknown): Donnees {
  const d = donneesVides()
  if (!estObjet(brut)) return d
  if (Array.isArray(brut.evenements)) d.evenements = fusionner(brut.evenements.filter(estEvenement))
  if (estObjet(brut.saisies)) {
    for (const [cle, s] of Object.entries(brut.saisies)) {
      if (!estCleJour(cle) || !estObjet(s)) continue
      const saisie = normaliserSaisie(s)
      if (Object.keys(saisie).length) d.saisies[cle] = saisie
    }
  }
  if (estObjet(brut.reglages)) d.reglages = normaliserReglages(brut.reglages)
  if (typeof brut.derniereLecture === 'number' && Number.isFinite(brut.derniereLecture)) d.derniereLecture = brut.derniereLecture
  if (typeof brut.derniereRechercheMaj === 'number' && Number.isFinite(brut.derniereRechercheMaj)) d.derniereRechercheMaj = brut.derniereRechercheMaj
  return d
}

/** Modification d'un jour : une chaîne fixe la valeur, null revient à la valeur détectée (ou par défaut). */
export type ModifSaisie = Partial<Record<Champ | 'type' | Texte, string | null>>

export function appliquerSaisie(donnees: Donnees, cle: string, modif: ModifSaisie): Donnees {
  if (!estCleJour(cle)) throw new Error(`Jour invalide : « ${cle} ».`)
  const jour = nomJourLong(cle)
  const saisie: Saisie = { ...donnees.saisies[cle] }
  for (const champ of CHAMPS) {
    if (!(champ in modif)) continue
    const v = modif[champ]
    if (v === null || v === undefined) delete saisie[champ]
    else if (v.trim() === '') saisie[champ] = ''
    else if (lireHeure(v) === null) throw new Error(`Heure de ${LIBELLES_CHAMPS[champ]} invalide pour le ${jour} : « ${v} ».`)
    else saisie[champ] = normaliserHeure(v)
  }
  if ('type' in modif) {
    const v = modif.type
    if (v === null || v === undefined || v === typeParDefaut(cle, donnees.reglages)) delete saisie.type
    else if (estType(v)) saisie.type = v
    else throw new Error(`Type de jour inconnu pour le ${jour} : « ${v} ».`)
  }
  for (const [champ, max] of Object.entries(TEXTES) as [Texte, number][]) {
    if (!(champ in modif)) continue
    const v = modif[champ]?.trim()
    if (v) saisie[champ] = v.slice(0, max)
    else delete saisie[champ]
  }
  const saisies = { ...donnees.saisies }
  if (Object.keys(saisie).length) saisies[cle] = saisie
  else delete saisies[cle]
  return { ...donnees, saisies }
}

export function appliquerReglages(donnees: Donnees, modif: Partial<Reglages>): Donnees {
  const r: Reglages = { ...donnees.reglages, ...modif }
  if (!entierEntre(r.objectif, 1, 24 * 60)) throw new Error('Durée quotidienne invalide : entre 0h01 et 24h00.')
  if (!Array.isArray(r.joursTravailles) || !r.joursTravailles.every((j) => entierEntre(j, 1, 7))) {
    throw new Error('Jours travaillés invalides.')
  }
  r.joursTravailles = [...new Set(r.joursTravailles)].sort()
  if (!estHeure(r.pauseDebut) || !r.pauseDebut) throw new Error(`Début de plage de pause invalide : « ${r.pauseDebut} ».`)
  if (!estHeure(r.pauseFin) || !r.pauseFin) throw new Error(`Fin de plage de pause invalide : « ${r.pauseFin} ».`)
  r.pauseDebut = normaliserHeure(r.pauseDebut)
  r.pauseFin = normaliserHeure(r.pauseFin)
  if (lireHeure(r.pauseDebut)! >= lireHeure(r.pauseFin)!) {
    throw new Error(`La plage de pause doit finir après son début (${r.pauseDebut} – ${r.pauseFin}).`)
  }
  if (!entierEntre(r.pauseMin, 1, 240)) throw new Error('Pause minimale invalide : entre 1 et 240 minutes.')
  if (!entierEntre(r.pausePrevue, 0, 240)) throw new Error('Pause prévue invalide : entre 0 et 240 minutes.')
  if (!entierEntre(r.soldeInitial, -100_000, 100_000)) throw new Error(`Solde de départ invalide : ${formatDuree(r.soldeInitial, true)}.`)
  if (r.dateDebut !== '' && !estCleJour(r.dateDebut)) throw new Error(`Date de début invalide : « ${r.dateDebut} ».`)
  if (typeof r.notifier !== 'boolean') throw new Error('Réglage de notification invalide.')
  if (!estTheme(r.theme)) throw new Error(`Thème inconnu : « ${String(r.theme)} ».`)
  if (typeof r.majAuto !== 'boolean') throw new Error('Réglage de mise à jour automatique invalide.')
  return { ...donnees, reglages: r }
}

/** Activités déjà saisies, les plus récentes d'abord, sans doublon (casse ignorée) : propositions de saisie. */
export function activitesConnues(saisies: Donnees['saisies'], max = 30): string[] {
  const vues = new Map<string, string>()
  for (const cle of Object.keys(saisies).sort().reverse()) {
    for (const a of [saisies[cle].apresMidi, saisies[cle].matin]) {
      if (a && !vues.has(a.toLocaleLowerCase('fr'))) vues.set(a.toLocaleLowerCase('fr'), a)
    }
    if (vues.size >= max) break
  }
  return [...vues.values()].slice(0, max)
}
