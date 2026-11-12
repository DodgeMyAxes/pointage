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

/** Écart sous lequel deux événements de même nature qui se suivent sont un seul et même événement. */
export const ECART_DOUBLON = 2 * 60_000

/**
 * Réunit des listes d'événements, sans doublon, dans l'ordre chronologique. Un événement qui suit de moins de
 * deux minutes un autre de même nature, sans rien entre eux, est écarté : Windows signale parfois deux fois un
 * déverrouillage, et le journal écrit certains événements sous deux sources (démarrage). Sans effet sur le calcul :
 * le second ne change ni la présence ni l'absence.
 */
export function fusionner(...listes: readonly (readonly Evenement[])[]): Evenement[] {
  const vus = new Map<string, Evenement>()
  for (const liste of listes) for (const e of liste) vus.set(`${e.t}|${e.nature}`, { t: e.t, nature: e.nature })
  const tries = [...vus.values()].sort((a, b) => a.t - b.t || a.nature.localeCompare(b.nature))
  const res: Evenement[] = []
  for (const e of tries) {
    const avant = res.at(-1)
    if (avant && avant.nature === e.nature && e.t - avant.t < ECART_DOUBLON) continue
    res.push(e)
  }
  return res
}
