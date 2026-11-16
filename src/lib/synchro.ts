import type { Donnees } from './donnees'
import { fusionner, type Evenement, type Nature } from './evenements'
import { DEBUT_JOURNEE, cleJourneeDe, instant } from './temps'

/** Relit le journal à partir d'un peu avant la dernière lecture, pour ne rien manquer autour d'une veille. */
export const MARGE_RELECTURE = 2 * 24 * 60 * 60_000

export type LecteurJournal = (depuis?: number) => Promise<Evenement[]>

/**
 * Ajoute aux données les événements du journal Windows. La première fois, la lecture part du début du mois du
 * décompte (sinon du mois en cours) : l'historique plus ancien ne servirait à rien ; ensuite, seulement depuis la
 * dernière lecture. Les événements lus sont ajoutés aux données du moment (`actuelles()` après la lecture) : une
 * saisie ou un verrouillage noté pendant la lecture n'est pas perdu.
 */
export async function synchroniser(actuelles: () => Donnees, lire: LecteurJournal, maintenant: number): Promise<Donnees> {
  const avant = actuelles()
  const depuis = avant.derniereLecture === undefined
    ? debutPremiereLecture(avant.reglages.dateDebut, maintenant)
    : avant.derniereLecture - MARGE_RELECTURE
  const nouveaux = await lire(depuis)
  const apres = actuelles()
  return { ...apres, evenements: fusionner(apres.evenements, nouveaux), derniereLecture: maintenant }
}

/** Premier jour du mois du début du décompte (ou du mois en cours), à l'heure où commence une journée. */
export function debutPremiereLecture(dateDebut: string, maintenant: number): number {
  const mois = (dateDebut || cleJourneeDe(maintenant)).slice(0, 7)
  return instant(`${mois}-01`, DEBUT_JOURNEE)
}

export function ajouterEvenement(donnees: Donnees, nature: Nature, t: number): Donnees {
  return { ...donnees, evenements: fusionner(donnees.evenements, [{ t, nature }]) }
}
