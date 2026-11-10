/** Dates et durées, toujours en heure locale. Une durée est un nombre entier de minutes. */

export const MINUTE = 60_000

/** Une journée de travail commence à 4 h : ce qui se passe après minuit appartient encore à la veille. */
export const DEBUT_JOURNEE = 4 * 60

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

const deux = (n: number) => String(n).padStart(2, '0')

/** Clé « AAAA-MM-JJ » du jour local d'un instant. */
export function cleJour(t: number | Date): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}

export function dateDeCle(cle: string): Date {
  const [a, m, j] = cle.split('-').map(Number)
  return new Date(a, m - 1, j)
}

export function estCleJour(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur) && cleJour(dateDeCle(valeur)) === valeur
}

/** Journée de travail à laquelle appartient un instant (voir DEBUT_JOURNEE). */
export function cleJourneeDe(t: number): string {
  const d = new Date(t)
  return d.getHours() * 60 + d.getMinutes() < DEBUT_JOURNEE ? ajouterJours(cleJour(d), -1) : cleJour(d)
}

export function ajouterJours(cle: string, n: number): string {
  const d = dateDeCle(cle)
  d.setDate(d.getDate() + n)
  return cleJour(d)
}

export function ecartJours(de: string, a: string): number {
  return Math.round((dateDeCle(a).getTime() - dateDeCle(de).getTime()) / 86_400_000)
}

/** 1 = lundi … 7 = dimanche. */
export function jourSemaine(cle: string): number {
  return dateDeCle(cle).getDay() || 7
}

export function lundiDe(cle: string): string {
  return ajouterJours(cle, 1 - jourSemaine(cle))
}

/** Numéro de semaine ISO 8601. */
export function numeroSemaine(cle: string): number {
  const jeudi = ajouterJours(cle, 4 - jourSemaine(cle))
  return Math.floor(ecartJours(`${jeudi.slice(0, 4)}-01-01`, jeudi) / 7) + 1
}

/** « 8:05 », « 08:05 », « 8h05 » ou « 8h » → minutes depuis minuit ; null si invalide. */
export function lireHeure(texte: string): number | null {
  const m = /^\s*(\d{1,2})\s*[:hH]\s*(\d{2})?\s*$/.exec(texte)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  return h < 24 && min < 60 ? h * 60 + min : null
}

/** Minutes depuis minuit → « HH:MM ». */
export function ecrireHeure(minutes: number): string {
  return `${deux(Math.floor(minutes / 60) % 24)}:${deux(minutes % 60)}`
}

/** Instant d'une heure locale d'un jour donné (correct les jours de changement d'heure). */
export function instant(cle: string, minutes: number): number {
  const [a, m, j] = cle.split('-').map(Number)
  return new Date(a, m - 1, j, Math.floor(minutes / 60), minutes % 60).getTime()
}

export function heureDe(t: number): string {
  const d = new Date(t)
  return `${deux(d.getHours())}:${deux(d.getMinutes())}`
}

export function tronquerMinute(t: number): number {
  return Math.floor(t / MINUTE) * MINUTE
}

/** 442 → « 7h22 » ; avec signe : « +0h15 », « -1h03 ». */
export function formatDuree(minutes: number, signe = false): string {
  const arrondi = Math.round(minutes)
  const prefixe = arrondi < 0 ? '-' : signe ? '+' : ''
  const a = Math.abs(arrondi)
  return `${prefixe}${Math.floor(a / 60)}h${deux(a % 60)}`
}

/** « 7h22 », « 7:22 », « -1h03 », « +2 » (heures) → minutes ; null si invalide. */
export function lireDuree(texte: string): number | null {
  const m = /^\s*([+\-−]?)\s*(\d{1,4})\s*(?:[:hH]\s*(\d{1,2})?)?\s*$/.exec(texte)
  if (!m) return null
  const min = Number(m[3] ?? 0)
  if (min >= 60) return null
  const valeur = Number(m[2]) * 60 + min
  return m[1] === '-' || m[1] === '−' ? -valeur : valeur
}

/** « lun. 09/11 » */
export function nomJourCourt(cle: string): string {
  const d = dateDeCle(cle)
  return `${JOURS[d.getDay()].slice(0, 3)}. ${deux(d.getDate())}/${deux(d.getMonth() + 1)}`
}

/** « lundi 9 novembre », « mardi 1er décembre » */
export function nomJourLong(cle: string): string {
  const d = dateDeCle(cle)
  const jour = d.getDate() === 1 ? '1er' : String(d.getDate())
  return `${JOURS[d.getDay()]} ${jour} ${MOIS[d.getMonth()]}`
}

/** « 2026-11 » → « novembre 2026 » */
export function nomMois(cleMois: string): string {
  const [a, m] = cleMois.split('-').map(Number)
  return `${MOIS[m - 1]} ${a}`
}

export function ajouterMois(cleMois: string, n: number): string {
  const [a, m] = cleMois.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}`
}

/** Toutes les clés de jour de `de` à `a` inclus. */
export function plageJours(de: string, a: string): string[] {
  const res: string[] = []
  for (let cle = de; cle <= a; cle = ajouterJours(cle, 1)) res.push(cle)
  return res
}

export function joursDuMois(cleMois: string): string[] {
  return plageJours(`${cleMois}-01`, ajouterJours(`${ajouterMois(cleMois, 1)}-01`, -1))
}
