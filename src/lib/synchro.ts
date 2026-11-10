import type { Donnees } from './donnees'
import { fusionner, type Evenement, type Nature } from './evenements'

/** Relit le journal à partir d'un peu avant la dernière lecture, pour ne rien manquer autour d'une veille. */
export const MARGE_RELECTURE = 2 * 24 * 60 * 60_000

export type LecteurJournal = (depuis?: number) => Promise<Evenement[]>

/**
 * Ajoute aux données les événements du journal Windows. La première fois, tout le journal est lu
 * (souvent plusieurs semaines d'historique) ; ensuite, seulement depuis la dernière lecture.
 */
export async function synchroniser(donnees: Donnees, lire: LecteurJournal, maintenant: number): Promise<Donnees> {
  const depuis = donnees.derniereLecture === undefined ? undefined : donnees.derniereLecture - MARGE_RELECTURE
  const nouveaux = await lire(depuis)
  return { ...donnees, evenements: fusionner(donnees.evenements, nouveaux), derniereLecture: maintenant }
}

export function ajouterEvenement(donnees: Donnees, nature: Nature, t: number): Donnees {
  return { ...donnees, evenements: fusionner(donnees.evenements, [{ t, nature }]) }
}
