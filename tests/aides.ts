import { donneesVides, type Donnees, type Saisie } from '../src/lib/donnees'
import type { Evenement, Nature } from '../src/lib/evenements'
import { instant, lireHeure } from '../src/lib/temps'

/** Instant local « HH:MM » ou « HH:MM:SS » d'un jour. */
export function a(cle: string, heure: string): number {
  const [hm, s] = [heure.slice(0, 5), Number(heure.slice(6) || 0)]
  return instant(cle, lireHeure(hm)!) + s * 1000
}

export function ev(cle: string, heure: string, nature: Nature): Evenement {
  return { t: a(cle, heure), nature }
}

export function donnees(evenements: Evenement[] = [], saisies: Record<string, Saisie> = {}): Donnees {
  return { ...donneesVides(), evenements, saisies }
}

/** Journée type avec démarrage rapide : démarrage, veille de midi, arrêt le soir. */
export function journeeType(cle: string, debut = '08:10', pause = '12:03', reprise = '13:31', fin = '16:58'): Evenement[] {
  return [
    ev(cle, `${debut}:17`, 'demarrage'),
    ev(cle, `${debut}:18`, 'reveil'),
    ev(cle, `${debut}:50`, 'ouverture'),
    ev(cle, `${pause}:10`, 'veille'),
    ev(cle, `${reprise}:05`, 'reveil'),
    ev(cle, `${fin}:20`, 'fermeture'),
    ev(cle, `${fin}:30`, 'veille'),
  ]
}
