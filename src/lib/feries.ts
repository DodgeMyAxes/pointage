import { ajouterJours, cleJour } from './temps'

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
export function paques(annee: number): string {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31)
  const jour = ((h + l - 7 * m + 114) % 31) + 1
  return cleJour(new Date(annee, mois - 1, jour))
}

const cache = new Map<number, Map<string, string>>()

/** Jours fériés de France métropolitaine : clé du jour → nom. */
export function joursFeries(annee: number): Map<string, string> {
  let feries = cache.get(annee)
  if (!feries) {
    const p = paques(annee)
    feries = new Map([
      [`${annee}-01-01`, "Jour de l'an"],
      [ajouterJours(p, 1), 'Lundi de Pâques'],
      [`${annee}-05-01`, 'Fête du Travail'],
      [`${annee}-05-08`, 'Victoire 1945'],
      [ajouterJours(p, 39), 'Ascension'],
      [ajouterJours(p, 50), 'Lundi de Pentecôte'],
      [`${annee}-07-14`, 'Fête nationale'],
      [`${annee}-08-15`, 'Assomption'],
      [`${annee}-11-01`, 'Toussaint'],
      [`${annee}-11-11`, 'Armistice 1918'],
      [`${annee}-12-25`, 'Noël'],
    ])
    cache.set(annee, feries)
  }
  return feries
}

export function nomFerie(cle: string): string | undefined {
  return joursFeries(Number(cle.slice(0, 4))).get(cle)
}
