/** Mises à jour : versions publiées sur GitHub (dépôt public, code seulement) ou installateur choisi à la main. */

import { cleJourneeDe, lundiDe } from './temps'

export const DEPOT = 'DodgeMyAxes/pointage'
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

/** Dossier où l'installateur (par utilisateur, en un clic) place Pointage : %LOCALAPPDATA%\Programs\pointage. */
export function dossierInstallation(localAppData: string): string {
  return `${localAppData.replace(/[\\/]+$/, '')}\\Programs\\pointage`
}

/** Désinstalleur posé par l'installateur à côté de Pointage.exe, pour une installation par utilisateur ou pour tous. */
export const NOM_DESINSTALLEUR = 'Uninstall Pointage.exe'

/**
 * Clé Windows de l'installation (« Applications installées »), tirée par electron-builder de appId
 * (fr.thomas.pointage) : la même sur tous les PC.
 */
export const CLE_INSTALLATION = '5f15d06e-da00-54b3-8169-c916b4b8b643'

const normaliserChemin = (chemin: string) => chemin.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
const dossierDe = (chemin: string) => chemin.replace(/[\\/][^\\/]*$/, '')

/** Fichier témoin posé à côté de Pointage.exe dans la version portable (zip). */
export const TEMOIN_PORTABLE = 'portable.txt'

/**
 * Version portable : dossier `donnees` à côté de Pointage.exe quand le fichier témoin s'y trouve, sinon undefined.
 * Une copie installée (désinstalleur à côté) n'est jamais portable, même si le témoin y a été copié.
 */
export function dossierPortable(exe: string, existe: (chemin: string) => boolean): string | undefined {
  const dossier = dossierDe(exe)
  if (estCopieInstallee(exe, existe) || !existe(`${dossier}\\${TEMOIN_PORTABLE}`)) return undefined
  return `${dossier}\\donnees`
}

/** Variables d'environnement utiles pour juger l'emplacement de la version portable. */
export interface EnvEmplacement {
  TEMP?: string
  TMP?: string
  USERPROFILE?: string
  OneDrive?: string
  OneDriveCommercial?: string
  OneDriveConsumer?: string
}

/**
 * Emplacement de la version portable : `bloquant` quand Pointage est lancé depuis l'intérieur du zip (Windows l'a
 * décompressé dans un dossier temporaire, les heures y seraient perdues) ; `avertissement` pour un dossier synchronisé
 * par OneDrive (fichier verrouillé pendant la synchro, copies en conflit), Téléchargements (souvent vidé) ou réseau.
 */
export function jugerEmplacement(exe: string, env: EnvEmplacement): { bloquant?: string; avertissement?: string } {
  const dossier = normaliserChemin(dossierDe(exe))
  const sous = (parent?: string) => !!parent && (dossier + '\\').startsWith(normaliserChemin(parent) + '\\')
  const conseil = 'Conseil : placez le dossier « Pointage » dans votre dossier personnel (tapez %USERPROFILE% dans la barre d’adresse de l’Explorateur), voir LISEZMOI.txt.'
  if (sous(env.TEMP) || sous(env.TMP) || /\.zip\\|\\temp\d*_/i.test(dossier + '\\')) {
    return { bloquant: `Pointage a été ouvert directement depuis le fichier zip : Windows l’a copié dans un dossier temporaire et vos heures y seraient perdues.\n\nFermez cette fenêtre, extrayez d’abord le dossier « Pointage » du zip, puis lancez Pointage.exe depuis ce dossier.\n\n${conseil}` }
  }
  if ([env.OneDrive, env.OneDriveCommercial, env.OneDriveConsumer].some(sous) || /\\onedrive( - [^\\]+)?\\/i.test(dossier + '\\')) {
    return { avertissement: `Pointage est dans un dossier synchronisé par OneDrive (${dossierDe(exe)}). La synchronisation peut bloquer l’enregistrement de vos heures ou créer des copies en conflit.\n\n${conseil}` }
  }
  if (sous(env.USERPROFILE && `${env.USERPROFILE}\\Downloads`)) {
    return { avertissement: `Pointage est dans le dossier Téléchargements, que Windows ou l’entreprise vident parfois : vos heures pourraient disparaître.\n\n${conseil}` }
  }
  if (dossier.startsWith('\\\\')) {
    return { avertissement: `Pointage est sur un dossier réseau (${dossierDe(exe)}) : hors connexion, vos heures ne pourront pas être enregistrées.\n\n${conseil}` }
  }
  return {}
}

/** Page GitHub d'une version (la dernière si aucune n'est donnée), où télécharger le zip portable. */
export function pageVersion(version?: string): string {
  return version ? `https://github.com/${DEPOT}/releases/tag/v${version}` : `https://github.com/${DEPOT}/releases/latest`
}

/**
 * Vrai si l'exécutable est une copie installée (désinstalleur à côté), dans AppData ou dans Program Files, et non
 * une autre copie (développement, comme release\win-unpacked) : une mise à jour ne remplace que la copie installée.
 */
export function estCopieInstallee(exe: string, existe: (chemin: string) => boolean): boolean {
  return existe(`${dossierDe(exe)}\\${NOM_DESINSTALLEUR}`)
}

/**
 * Ancienne installation par utilisateur (AppData) à effacer quand Pointage tourne désormais depuis une autre
 * installation (Program Files, pour un PC d'entreprise qui interdit les programmes dans AppData).
 */
export function ancienneInstallationAEffacer(
  exe: string, localAppData: string | undefined, existe: (chemin: string) => boolean,
): string | undefined {
  if (!localAppData || !estCopieInstallee(exe, existe)) return undefined
  const ancien = dossierInstallation(localAppData)
  if (normaliserChemin(dossierDe(exe)) === normaliserChemin(ancien)) return undefined
  return existe(`${ancien}\\${NOM_DESINSTALLEUR}`) ? ancien : undefined
}

/** Après un échec (réseau pas encore prêt au réveil…), la recherche automatique attend une heure avant de réessayer. */
export const DELAI_NOUVEL_ESSAI_MAJ = 60 * 60_000

/**
 * Recherche automatique due : aucune recherche réussie depuis le début de la semaine (lundi 4 h, début de la
 * journée de travail). Elle a donc lieu au premier démarrage ou réveil du lundi, ou du premier jour utilisé de la semaine.
 */
export function rechercheHebdoDue(derniere: number | undefined, maintenant: number): boolean {
  if (derniere === undefined || derniere > maintenant) return true
  return cleJourneeDe(derniere) < lundiDe(cleJourneeDe(maintenant))
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
