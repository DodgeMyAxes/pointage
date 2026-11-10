/**
 * Lecture du journal « Système » de Windows, extrait par `wevtutil qe System /f:xml`.
 *
 * Événements retenus (présents par défaut sur tout Windows, sans réglage d'audit) :
 * - Kernel-General 12, Kernel-Boot 27 : démarrage (y compris « démarrage rapide ») ;
 * - Winlogon 7001 / 7002 : ouverture / fermeture de session ;
 * - Power-Troubleshooter 1 : sortie de veille ou de veille prolongée ;
 * - Kernel-Power 42 : mise en veille (l'arrêt en démarrage rapide passe aussi par là) ;
 * - Kernel-General 13, User32 1074 : arrêt ou redémarrage.
 * Kernel-Power 107 est ignoré : il est horodaté avec l'horloge d'avant la veille.
 */
import { fusionner, type Evenement, type Nature } from './evenements'

const SOURCES: readonly { fournisseur: string; ids: Readonly<Record<number, Nature>> }[] = [
  { fournisseur: 'Microsoft-Windows-Kernel-General', ids: { 12: 'demarrage', 13: 'arret' } },
  { fournisseur: 'Microsoft-Windows-Kernel-Boot', ids: { 27: 'demarrage' } },
  { fournisseur: 'Microsoft-Windows-Winlogon', ids: { 7001: 'ouverture', 7002: 'fermeture' } },
  { fournisseur: 'Microsoft-Windows-Power-Troubleshooter', ids: { 1: 'reveil' } },
  { fournisseur: 'Microsoft-Windows-Kernel-Power', ids: { 42: 'veille' } },
  { fournisseur: 'User32', ids: { 1074: 'arret' } },
]

/** Requête XPath pour wevtutil, éventuellement limitée aux événements postérieurs à `depuis`. */
export function requeteJournal(depuis?: number): string {
  const conditions = SOURCES.map(
    (s) => `(Provider[@Name='${s.fournisseur}'] and (${Object.keys(s.ids).map((id) => `EventID=${id}`).join(' or ')}))`,
  ).join(' or ')
  const temps = depuis === undefined ? '' : ` and TimeCreated[@SystemTime>='${new Date(depuis).toISOString()}']`
  return `*[System[(${conditions})${temps}]]`
}

/** « 2026-11-08T10:42:00.8042052Z » → millisecondes ; null si le format est inattendu. */
export function lireInstantUtc(texte: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/.exec(texte)
  if (!m) return null
  const t = Date.parse(`${m[1]}.${(m[2] ?? '').padEnd(3, '0').slice(0, 3)}Z`)
  return Number.isNaN(t) ? null : t
}

export function analyserJournal(xml: string): Evenement[] {
  const res: Evenement[] = []
  for (const [bloc] of xml.matchAll(/<Event[\s>][\s\S]*?<\/Event>/g)) {
    const fournisseur = /<Provider\s+Name=['"]([^'"]+)['"]/.exec(bloc)?.[1]
    const id = Number(/<EventID[^>]*>(\d+)<\/EventID>/.exec(bloc)?.[1])
    const horodatage = /<TimeCreated\s+SystemTime=['"]([^'"]+)['"]/.exec(bloc)?.[1]
    const nature = SOURCES.find((s) => s.fournisseur === fournisseur)?.ids[id]
    const t = horodatage ? lireInstantUtc(horodatage) : null
    if (nature && t !== null) res.push({ t, nature })
  }
  return fusionner(res)
}
