/** Mises à jour : versions publiées sur GitHub (dépôt public, code seulement) ou installateur choisi à la main. */

export const DEPOT = 'Arceus33/pointage'
export const URL_DERNIERE_VERSION = `https://api.github.com/repos/${DEPOT}/releases/latest`
const MOTIF_INSTALLATEUR = /^Pointage-Installation-(\d+\.\d+\.\d+)\.exe$/i

export interface Installateur {
  nom: string
  url: string
  taille: number
  /** Empreinte SHA-256 annoncée par GitHub, en hexadécimal, si disponible. */
  sha256?: string
}

export interface VersionPubliee {
  version: string
  notes: string
  /** Date de publication, « AAAA-MM-JJ ». */
  date: string
  installateur: Installateur
}

/** État des mises à jour présenté dans la fenêtre. */
export interface EtatMaj {
  statut: 'inconnu' | 'recherche' | 'a-jour' | 'disponible' | 'telechargement' | 'installation' | 'erreur'
  disponible?: VersionPubliee
  /** Avancement du téléchargement, 0 à 100. */
  progression?: number
  erreur?: string
  /** Instant de la dernière recherche réussie. */
  verifieLe?: number
}

/** Compare deux versions « X.Y.Z » : négatif si a < b, 0 si égales, positif si a > b. */
export function comparerVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const ecart = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (ecart) return ecart
  }
  return 0
}

/** Version d'un installateur d'après son nom (« Pointage-Installation-0.2.0.exe ») ; null si ce n'en est pas un. */
export function versionDepuisNom(nom: string): string | null {
  return MOTIF_INSTALLATEUR.exec(nom)?.[1] ?? null
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Lit la réponse de l'API GitHub « releases/latest ». */
export function lireVersionPubliee(reponse: unknown): VersionPubliee {
  if (!estObjet(reponse) || typeof reponse.tag_name !== 'string') throw new Error('Réponse de GitHub illisible.')
  const version = reponse.tag_name.replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Numéro de version publié invalide : « ${reponse.tag_name} ».`)
  const fichiers = Array.isArray(reponse.assets) ? reponse.assets.filter(estObjet) : []
  const fichier = fichiers.find((f) => typeof f.name === 'string' && versionDepuisNom(f.name) === version)
  if (!fichier || typeof fichier.browser_download_url !== 'string' || typeof fichier.size !== 'number') {
    throw new Error(`La version ${version} est publiée sans installateur.`)
  }
  const installateur: Installateur = { nom: fichier.name as string, url: fichier.browser_download_url, taille: fichier.size }
  if (typeof fichier.digest === 'string' && /^sha256:[0-9a-f]{64}$/i.test(fichier.digest)) {
    installateur.sha256 = fichier.digest.slice(7).toLowerCase()
  }
  return {
    version,
    notes: typeof reponse.body === 'string' ? reponse.body.trim() : '',
    date: typeof reponse.published_at === 'string' ? reponse.published_at.slice(0, 10) : '',
    installateur,
  }
}

/** Notes de version Markdown simplifiées en lignes de texte (titres et puces sans leurs marques). */
export function lignesNotes(notes: string): string[] {
  return notes
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+)/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim())
    .filter(Boolean)
}
