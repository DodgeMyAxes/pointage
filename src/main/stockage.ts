/** Fichier de données JSON : écriture atomique, copie de secours de la version précédente. */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { donneesVides, normaliser, type Donnees } from '../lib/donnees'

export interface Chargement {
  donnees: Donnees
  /** Aucun fichier : premier lancement. */
  nouveau: boolean
  avertissement?: string
}

const secours = (chemin: string) => `${chemin}.bak`

function lire(chemin: string): Donnees {
  return normaliser(JSON.parse(readFileSync(chemin, 'utf8')))
}

export function charger(chemin: string): Chargement {
  if (!existsSync(chemin)) {
    if (existsSync(secours(chemin))) {
      try {
        return { donnees: lire(secours(chemin)), nouveau: false, avertissement: 'Données reprises de la copie de secours.' }
      } catch { /* copie illisible : on repart de zéro ci-dessous */ }
    }
    return { donnees: donneesVides(), nouveau: true }
  }
  try {
    return { donnees: lire(chemin), nouveau: false }
  } catch {
    // Fichier abîmé : on le met de côté (jamais supprimé) et on tente la copie de secours.
    const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
    renameSync(chemin, `${chemin}.abime-${horodatage}`)
    try {
      return { donnees: lire(secours(chemin)), nouveau: false, avertissement: 'Fichier de données abîmé : copie de secours reprise.' }
    } catch {
      return { donnees: donneesVides(), nouveau: false, avertissement: 'Fichier de données abîmé et sans copie de secours : il a été mis de côté.' }
    }
  }
}

export function enregistrer(chemin: string, donnees: Donnees): void {
  mkdirSync(dirname(chemin), { recursive: true })
  const temporaire = `${chemin}.tmp`
  writeFileSync(temporaire, JSON.stringify(donnees), 'utf8')
  if (existsSync(chemin)) copyFileSync(chemin, secours(chemin))
  renameSync(temporaire, chemin)
}
