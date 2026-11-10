/**
 * Recherche, téléchargement et installation des mises à jour. Le réseau passe par `net` d'Electron : il suit le
 * proxy et les certificats de Windows, ce qui compte sur un réseau d'entreprise.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app, net } from 'electron'
import { URL_DERNIERE_VERSION, lireVersionPubliee, type Installateur, type VersionPubliee } from '../lib/maj'

/** Dernière version publiée ; null si aucune version n'est encore publiée. */
export async function chercherDerniereVersion(): Promise<VersionPubliee | null> {
  let reponse: Response
  try {
    reponse = await net.fetch(URL_DERNIERE_VERSION, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Pointage/${app.getVersion()}` },
      cache: 'no-store',
    })
  } catch {
    throw new Error('GitHub injoignable : vérifiez la connexion à Internet (le réseau de l’entreprise bloque peut-être github.com).')
  }
  if (reponse.status === 404) return null
  if (reponse.status === 403 || reponse.status === 429) throw new Error('GitHub limite les recherches pour le moment : réessayez dans une heure.')
  if (!reponse.ok) throw new Error(`GitHub a répondu ${reponse.status} à la recherche de mise à jour.`)
  return lireVersionPubliee(await reponse.json())
}

/** Télécharge l'installateur dans le dossier temporaire, en vérifiant sa taille et son empreinte. */
export async function telecharger(installateur: Installateur, surProgression: (pourcentage: number) => void): Promise<string> {
  const dossier = join(app.getPath('temp'), 'Pointage-mise-a-jour')
  rmSync(dossier, { recursive: true, force: true })
  mkdirSync(dossier, { recursive: true })
  const chemin = join(dossier, installateur.nom)

  const reponse = await net.fetch(installateur.url, { headers: { 'User-Agent': `Pointage/${app.getVersion()}` } })
  if (!reponse.ok || !reponse.body) throw new Error(`Téléchargement de ${installateur.nom} impossible (réponse ${reponse.status}).`)
  const empreinte = createHash('sha256')
  let recu = 0
  let dernier = -1
  const flux = Readable.fromWeb(reponse.body as import('node:stream/web').ReadableStream<Uint8Array>)
  flux.on('data', (morceau: Buffer) => {
    empreinte.update(morceau)
    recu += morceau.length
    const pourcentage = Math.min(100, Math.floor((recu / installateur.taille) * 100))
    if (pourcentage !== dernier) {
      dernier = pourcentage
      surProgression(pourcentage)
    }
  })
  await pipeline(flux, createWriteStream(chemin))

  if (recu !== installateur.taille) throw new Error(`Téléchargement de ${installateur.nom} incomplet : réessayez.`)
  if (installateur.sha256 && empreinte.digest('hex') !== installateur.sha256) {
    rmSync(chemin, { force: true })
    throw new Error(`L’empreinte de ${installateur.nom} ne correspond pas à celle publiée : fichier écarté.`)
  }
  return chemin
}

/**
 * Lance l'installateur en silence (`/S`) comme une mise à jour (`--updated`) ; il remplace l'application, garde les
 * données (dans %APPDATA%) et relance Pointage (`--force-run`, qui reçoit alors `--updated`). L'application se ferme
 * aussitôt pour libérer ses fichiers.
 */
export function installer(chemin: string): void {
  spawn(chemin, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  setTimeout(() => app.quit(), 300)
}
