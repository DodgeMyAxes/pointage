/** Événements bruts : ce que Windows (ou l'application) a observé, sans interprétation. */

export const NATURES = [
  'demarrage', 'ouverture', 'reveil', 'deverrouillage',
  'veille', 'arret', 'fermeture', 'verrouillage',
] as const

export type Nature = (typeof NATURES)[number]

export interface Evenement {
  /** Instant en millisecondes (epoch). */
  t: number
  nature: Nature
}

/** Natures qui signalent que l'utilisateur est devant son PC ; les autres, qu'il l'a quitté. */
export const ALLUME: ReadonlySet<Nature> = new Set<Nature>(['demarrage', 'ouverture', 'reveil', 'deverrouillage'])

export const LIBELLES_NATURES: Record<Nature, string> = {
  demarrage: 'Démarrage du PC',
  ouverture: 'Ouverture de session',
  reveil: 'Sortie de veille',
  deverrouillage: 'Déverrouillage',
  veille: 'Mise en veille',
  arret: 'Arrêt du PC',
  fermeture: 'Fermeture de session',
  verrouillage: 'Verrouillage',
}

export function estEvenement(valeur: unknown): valeur is Evenement {
  if (typeof valeur !== 'object' || valeur === null) return false
  const e = valeur as Record<string, unknown>
  return typeof e.t === 'number' && Number.isFinite(e.t) && (NATURES as readonly unknown[]).includes(e.nature)
}

/** Réunit des listes d'événements, sans doublon, dans l'ordre chronologique. */
export function fusionner(...listes: readonly (readonly Evenement[])[]): Evenement[] {
  const vus = new Map<string, Evenement>()
  for (const liste of listes) for (const e of liste) vus.set(`${e.t}|${e.nature}`, { t: e.t, nature: e.nature })
  return [...vus.values()].sort((a, b) => a.t - b.t || a.nature.localeCompare(b.nature))
}
