import type { Conseil, Jour } from './calcul'
import { formatDuree, heureDe } from './temps'

/** Texte court pour l'infobulle de la zone de notification (127 caractères au plus sous Windows). */
export function resumeDuJour(jour: Jour, conseil: Conseil | null): string {
  if (!jour.arrivee) return 'Pointage : pas encore d’arrivée aujourd’hui'
  const morceaux = [`Arrivée ${heureDe(jour.arrivee.t)}`]
  if (jour.statut === 'en-cours') {
    morceaux.push(`${formatDuree(jour.travaille ?? 0)} faites`)
    if (conseil && (jour.travaille ?? 0) < jour.attendu) morceaux.push(`départ conseillé ${heureDe(conseil.objectif)}`)
    else if (jour.attendu > 0) morceaux.push('journée faite')
  } else if (jour.depart) {
    morceaux.push(`départ ${heureDe(jour.depart.t)}`)
    if (jour.ecart !== null) morceaux.push(`écart ${formatDuree(jour.ecart, true)}`)
  }
  return `Pointage : ${morceaux.join(' · ')}`.slice(0, 127)
}

/** Notification Windows envoyée quand le temps du jour est atteint. */
export function texteNotification(jour: Jour): { titre: string; corps: string } {
  const arrivee = jour.arrivee ? ` (arrivée à ${heureDe(jour.arrivee.t)})` : ''
  return {
    titre: 'Journée faite',
    corps: `Vos ${formatDuree(jour.attendu)} sont faites${arrivee}. Vous pouvez partir. Bonne fin de journée !`,
  }
}

/**
 * Faut-il prévenir que la journée est faite ? Seulement dans les minutes qui suivent le franchissement,
 * pour ne pas répéter la notification à chaque relance de l'application.
 */
export function journeeVientDEtreFaite(jour: Jour): boolean {
  return jour.statut === 'en-cours' && jour.attendu > 0 && jour.travaille !== null
    && jour.travaille >= jour.attendu && jour.travaille - jour.attendu < 5
}
