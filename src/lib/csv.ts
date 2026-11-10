import type { Jour } from './calcul'
import { LIBELLES_TYPES } from './donnees'
import { formatDuree, heureDe, nomJourCourt } from './temps'

const STATUTS: Record<Jour['statut'], string> = {
  complet: '',
  'en-cours': 'en cours',
  incomplet: 'incomplet',
  vide: 'à renseigner',
  futur: '',
}

function cellule(valeur: string): string {
  return /[";\n\r]/.test(valeur) ? `"${valeur.replaceAll('"', '""')}"` : valeur
}

/** Export pour Excel : séparateur « ; », BOM UTF-8 pour les accents. */
export function exporterCsv(jours: readonly Jour[]): string {
  const lignes = [
    ['Date', 'Jour', 'Type', 'Arrivée', 'Pause', 'Reprise', 'Départ', 'Travaillé', 'Attendu', 'Écart', 'État', 'Note'],
  ]
  for (const j of jours) {
    if (j.statut === 'futur') continue
    lignes.push([
      j.cle.split('-').reverse().join('/'),
      nomJourCourt(j.cle).split(' ')[0],
      LIBELLES_TYPES[j.type],
      j.arrivee ? heureDe(j.arrivee.t) : '',
      j.pause ? heureDe(j.pause.t) : '',
      j.reprise ? heureDe(j.reprise.t) : '',
      j.depart ? heureDe(j.depart.t) : '',
      j.travaille === null ? '' : formatDuree(j.travaille),
      formatDuree(j.attendu),
      j.ecart === null ? '' : formatDuree(j.ecart, true),
      j.alerte ?? STATUTS[j.statut],
      j.note ?? '',
    ])
  }
  return `﻿${lignes.map((l) => l.map(cellule).join(';')).join('\r\n')}\r\n`
}
