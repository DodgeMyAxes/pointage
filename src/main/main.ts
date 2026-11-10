/**
 * Processus principal : reste dans la zone de notification, lit le journal Windows au lancement, au réveil
 * et à la demande, note les verrouillages de session, et sert la fenêtre.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BrowserWindow, Menu, Notification, Tray, app, dialog, ipcMain, nativeImage, nativeTheme, powerMonitor, shell,
} from 'electron'
import type { Etat, Reponse } from '../lib/api'
import { calculerJour, departConseille, historique, solde, transitions } from '../lib/calcul'
import { exporterCsv } from '../lib/csv'
import { appliquerReglages, appliquerSaisie, donneesPremierLancement, normaliser, type Donnees, type ModifSaisie, type Reglages } from '../lib/donnees'
import type { Nature } from '../lib/evenements'
import { comparerVersions, versionDepuisNom, type EtatMaj } from '../lib/maj'
import { journeeVientDEtreFaite, resumeDuJour, texteNotification } from '../lib/resume'
import { ajouterEvenement, synchroniser } from '../lib/synchro'
import { cleJour, cleJourneeDe } from '../lib/temps'
import { lireJournalWindows } from './journal-windows'
import { chercherDerniereVersion, installer, telecharger } from './mises-a-jour'
import { charger, enregistrer } from './stockage'

/** Argument du lancement automatique : démarre caché dans la zone de notification. */
const ARG_DEMARRAGE = '--demarrage'

let donnees: Donnees
let cheminDonnees = ''
let fenetre: BrowserWindow | null = null
let tray: Tray | null = null
let erreurLecture: string | undefined
let lecture: Promise<void> | null = null
let derniereNotification = ''
let maj: EtatMaj = { statut: 'inconnu' }
let versionNotifiee = ''
/** Lancé par l'installateur juste après une mise à jour : la fenêtre l'annonce une fois. */
let misAJour = process.argv.includes('--updated')
const DELAI_RECHERCHE_MAJ = 6 * 60 * 60_000

const icone = () => nativeImage.createFromPath(join(__dirname, 'assets', 'icone.ico'))

// Développement : dossier de données séparé (POINTAGE_DOSSIER) et capture de la fenêtre puis sortie (POINTAGE_CAPTURE).
if (process.env.POINTAGE_DOSSIER) app.setPath('userData', process.env.POINTAGE_DOSSIER)
const capture = process.env.POINTAGE_CAPTURE
const themeForce = process.env.POINTAGE_THEME === 'light' || process.env.POINTAGE_THEME === 'dark' ? process.env.POINTAGE_THEME : undefined

/** Le thème choisi pilote `prefers-color-scheme` dans la fenêtre, et donc toutes ses couleurs. */
function appliquerTheme(): void {
  const sources = { systeme: 'system', clair: 'light', sombre: 'dark' } as const
  nativeTheme.themeSource = themeForce ?? sources[donnees.reglages.theme]
  fenetre?.setBackgroundColor(couleurFond())
}

const couleurFond = () => (nativeTheme.shouldUseDarkColors ? '#15171c' : '#f5f6f8')

if (!app.requestSingleInstanceLock()) app.quit()
else demarrer()

function demarrer(): void {
  app.setAppUserModelId('fr.thomas.pointage')
  app.on('second-instance', () => ouvrirFenetre())
  // Fermer la fenêtre ne quitte pas : l'application reste dans la zone de notification.
  app.on('window-all-closed', () => {})

  void app.whenReady().then(async () => {
    cheminDonnees = join(app.getPath('userData'), 'pointage.json')
    const chargement = charger(cheminDonnees)
    donnees = chargement.nouveau ? donneesPremierLancement(Date.now()) : chargement.donnees
    appliquerTheme()
    if (chargement.nouveau && app.isPackaged) definirAutostart(true)
    enregistrerIpc()
    creerTray()
    surveillerSession()
    if (!process.argv.includes(ARG_DEMARRAGE)) ouvrirFenetre()
    if (chargement.avertissement) void dialog.showMessageBox({ type: 'warning', title: 'Pointage', message: chargement.avertissement })
    await lireJournal()
    setInterval(tic, 60_000)
    // Recherche de mise à jour discrète, un peu après le démarrage puis toutes les 6 heures.
    if (app.isPackaged) {
      setTimeout(() => void rechercherMaj(true), 20_000)
      setInterval(() => void rechercherMaj(true), DELAI_RECHERCHE_MAJ)
    }
  })
}

// --- Mises à jour ------------------------------------------------------------------------------------------

function changerMaj(etatMaj: EtatMaj): void {
  maj = etatMaj
  fenetre?.webContents.send('maj')
}

/** Cherche une nouvelle version ; en mode automatique, ne fait rien si le réglage est coupé et prévient une seule fois par version. */
async function rechercherMaj(automatique: boolean): Promise<void> {
  if (automatique && !donnees.reglages.majAuto) return
  if (maj.statut === 'telechargement' || maj.statut === 'installation') return
  changerMaj({ ...maj, statut: 'recherche', erreur: undefined })
  try {
    const publiee = await chercherDerniereVersion()
    if (publiee && comparerVersions(publiee.version, app.getVersion()) > 0) {
      changerMaj({ statut: 'disponible', disponible: publiee, verifieLe: Date.now() })
      if (automatique && versionNotifiee !== publiee.version) {
        versionNotifiee = publiee.version
        notifier({ titre: 'Mise à jour disponible', corps: `Pointage ${publiee.version} est disponible. Cliquez pour l’installer depuis les Réglages.` })
      }
    } else {
      changerMaj({ statut: 'a-jour', verifieLe: Date.now() })
    }
  } catch (e) {
    changerMaj({ ...maj, statut: 'erreur', erreur: e instanceof Error ? e.message : String(e) })
  }
}

const REFUS_DEVELOPPEMENT = 'Version de développement : une mise à jour ne s’installe que depuis Pointage installé.'

// --- Données -----------------------------------------------------------------------------------------------

function sauver(): void {
  enregistrer(cheminDonnees, donnees)
}

function lireJournal(): Promise<void> {
  lecture ??= (async () => {
    try {
      donnees = await synchroniser(donnees, lireJournalWindows, Date.now())
      erreurLecture = undefined
      sauver()
    } catch (e) {
      erreurLecture = `Lecture du journal Windows impossible : ${e instanceof Error ? e.message : String(e)}`
    } finally {
      lecture = null
    }
    tic()
    fenetre?.webContents.send('maj')
  })()
  return lecture
}

function noter(nature: Nature): void {
  donnees = ajouterEvenement(donnees, nature, Date.now())
  try {
    sauver()
  } catch { /* nouvel essai à la prochaine écriture */ }
  fenetre?.webContents.send('maj')
}

function surveillerSession(): void {
  powerMonitor.on('lock-screen', () => noter('verrouillage'))
  powerMonitor.on('unlock-screen', () => noter('deverrouillage'))
  // Au réveil, Windows écrit l'événement de sortie de veille : on le relit peu après.
  powerMonitor.on('resume', () => setTimeout(() => void lireJournal(), 5_000))
}

// --- Démarrage automatique ---------------------------------------------------------------------------------

function argumentsAutostart(): string[] {
  return app.isPackaged ? [ARG_DEMARRAGE] : [app.getAppPath(), ARG_DEMARRAGE]
}

function lireAutostart(): boolean {
  return app.getLoginItemSettings({ path: process.execPath, args: argumentsAutostart() }).openAtLogin
}

function definirAutostart(actif: boolean): void {
  app.setLoginItemSettings({ openAtLogin: actif, path: process.execPath, args: argumentsAutostart() })
}

// --- Zone de notification ----------------------------------------------------------------------------------

function creerTray(): void {
  tray = new Tray(icone())
  tray.setToolTip('Pointage')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir Pointage', click: () => ouvrirFenetre() },
    { label: 'Relire le journal Windows', click: () => void lireJournal() },
    { label: 'Rechercher une mise à jour', click: () => { ouvrirFenetre(); void rechercherMaj(false) } },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() },
  ]))
  tray.on('click', () => ouvrirFenetre())
}

/** Chaque minute : infobulle à jour et notification quand la journée est faite. */
function tic(): void {
  const maintenant = Date.now()
  const trans = transitions(donnees.evenements)
  const jour = calculerJour(cleJourneeDe(maintenant), trans, donnees, maintenant)
  const jours = historique(donnees, maintenant, trans)
  const conseil = departConseille(jour, donnees.reglages, solde(donnees, jours), maintenant)
  tray?.setToolTip(resumeDuJour(jour, conseil))
  if (donnees.reglages.notifier && journeeVientDEtreFaite(jour) && derniereNotification !== jour.cle) {
    derniereNotification = jour.cle
    notifier(texteNotification(jour))
  }
}

/** Notification Windows ; un clic dessus ouvre la fenêtre. Renvoie false si Windows ne les prend pas en charge. */
function notifier({ titre, corps }: { titre: string; corps: string }): boolean {
  if (!Notification.isSupported()) return false
  const notification = new Notification({ title: titre, body: corps, icon: icone() })
  notification.on('click', () => ouvrirFenetre())
  notification.show()
  return true
}

// --- Fenêtre -----------------------------------------------------------------------------------------------

function ouvrirFenetre(): void {
  if (fenetre) {
    if (fenetre.isMinimized()) fenetre.restore()
    fenetre.show()
    fenetre.focus()
    return
  }
  fenetre = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 760,
    minHeight: 520,
    title: 'Pointage',
    icon: icone(),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: couleurFond(),
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  fenetre.setMenu(null)
  fenetre.webContents.on('will-navigate', (e) => e.preventDefault())
  fenetre.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  fenetre.once('ready-to-show', () => fenetre?.show())
  // Relire en revenant sur la fenêtre : les heures sont à jour sans y penser.
  fenetre.on('focus', () => void lireJournal())
  // Fenêtre détruite à la fermeture pour libérer la mémoire ; l'application reste en tâche de fond.
  fenetre.on('closed', () => { fenetre = null })
  void fenetre.loadFile(join(__dirname, 'renderer', 'index.html'))
  if (capture) {
    fenetre.webContents.once('did-finish-load', () => setTimeout(async () => {
      if (process.env.POINTAGE_CAPTURE_JS) {
        await fenetre!.webContents.executeJavaScript(process.env.POINTAGE_CAPTURE_JS)
        await new Promise((r) => setTimeout(r, 500))
      }
      const image = await fenetre!.webContents.capturePage()
      writeFileSync(capture, image.toPNG())
      app.quit()
    }, 3_000))
  }
}

// --- Échanges avec la fenêtre ------------------------------------------------------------------------------

function etat(): Etat {
  return {
    donnees,
    autostart: lireAutostart(),
    version: app.getVersion(),
    cheminDonnees,
    installee: app.isPackaged,
    erreurLecture,
    maj,
  }
}

const enregistrerSous = (options: Electron.SaveDialogOptions) =>
  fenetre ? dialog.showSaveDialog(fenetre, options) : dialog.showSaveDialog(options)
const ouvrirFichier = (options: Electron.OpenDialogOptions) =>
  fenetre ? dialog.showOpenDialog(fenetre, options) : dialog.showOpenDialog(options)
const demander = (options: Electron.MessageBoxOptions) =>
  fenetre ? dialog.showMessageBox(fenetre, options) : dialog.showMessageBox(options)

function modifier(action: () => Donnees | void, message?: string): Reponse {
  try {
    const resultat = action()
    if (resultat) {
      donnees = resultat
      sauver()
      tic()
    }
    return { ok: true, etat: etat(), message }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) }
  }
}

function enregistrerIpc(): void {
  ipcMain.handle('etat', () => etat())
  ipcMain.handle('relire', async (): Promise<Reponse> => {
    await lireJournal()
    return erreurLecture ? { ok: false, erreur: erreurLecture } : { ok: true, etat: etat(), message: 'Journal Windows relu.' }
  })
  ipcMain.handle('saisir', (_e, cle: string, modif: ModifSaisie) => modifier(() => appliquerSaisie(donnees, cle, modif)))
  ipcMain.handle('reglages', (_e, modif: Partial<Reglages>) => {
    const reponse = modifier(() => appliquerReglages(donnees, modif))
    appliquerTheme()
    return reponse
  })
  ipcMain.handle('autostart', (_e, actif: boolean) => modifier(() => {
    definirAutostart(actif)
  }, actif ? 'Pointage se lancera à l’ouverture de session Windows.' : 'Lancement automatique désactivé.'))

  ipcMain.handle('exporter-csv', async (): Promise<Reponse> => {
    const choix = await enregistrerSous({
      title: 'Exporter les heures',
      defaultPath: `pointage-${cleJour(Date.now())}.csv`,
      filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }],
    })
    if (choix.canceled || !choix.filePath) return { ok: true, etat: etat() }
    const chemin = choix.filePath
    return modifier(() => {
      writeFileSync(chemin, exporterCsv(historique(donnees, Date.now())), 'utf8')
    }, `Heures exportées dans ${chemin}.`)
  })

  ipcMain.handle('sauvegarder', async (): Promise<Reponse> => {
    const choix = await enregistrerSous({
      title: 'Sauvegarder les données',
      defaultPath: `pointage-sauvegarde-${cleJour(Date.now())}.json`,
      filters: [{ name: 'Sauvegarde Pointage', extensions: ['json'] }],
    })
    if (choix.canceled || !choix.filePath) return { ok: true, etat: etat() }
    const chemin = choix.filePath
    return modifier(() => {
      writeFileSync(chemin, JSON.stringify(donnees, null, 1), 'utf8')
    }, `Données sauvegardées dans ${chemin}.`)
  })

  ipcMain.handle('restaurer', async (): Promise<Reponse> => {
    const choix = await ouvrirFichier({
      title: 'Restaurer une sauvegarde',
      filters: [{ name: 'Sauvegarde Pointage', extensions: ['json'] }],
      properties: ['openFile'],
    })
    const chemin = choix.filePaths[0]
    if (choix.canceled || !chemin) return { ok: true, etat: etat() }
    let restaurees: Donnees
    try {
      restaurees = normaliser(JSON.parse(readFileSync(chemin, 'utf8')))
    } catch {
      return { ok: false, erreur: `Le fichier ${chemin} n’est pas une sauvegarde lisible.` }
    }
    const confirmation = await demander({
      type: 'warning',
      title: 'Restaurer une sauvegarde',
      message: 'Remplacer toutes les données actuelles par cette sauvegarde ?',
      detail: `${restaurees.evenements.length} événements et ${Object.keys(restaurees.saisies).length} jours corrigés. Les événements encore présents dans le journal Windows seront relus ensuite.`,
      buttons: ['Restaurer', 'Annuler'],
      defaultId: 1,
      cancelId: 1,
    })
    if (confirmation.response !== 0) return { ok: true, etat: etat() }
    const reponse = modifier(() => ({ ...restaurees, derniereLecture: undefined }), 'Sauvegarde restaurée.')
    await lireJournal()
    return reponse.ok ? { ...reponse, etat: etat() } : reponse
  })

  ipcMain.handle('tester-notification', (): Reponse => {
    const exemple = calculerJour(cleJourneeDe(Date.now()), transitions(donnees.evenements), donnees, Date.now())
    const { corps } = texteNotification({ ...exemple, attendu: donnees.reglages.objectif })
    if (!notifier({ titre: 'Journée faite (essai)', corps })) {
      return { ok: false, erreur: 'Windows ne prend pas en charge les notifications sur ce PC.' }
    }
    return {
      ok: true,
      etat: etat(),
      message: 'Notification d’essai envoyée. Si rien n’apparaît en bas à droite de l’écran, vérifiez Paramètres Windows → Système → Notifications (Pointage activé, mode Ne pas déranger coupé).',
    }
  })

  ipcMain.handle('annonce-mise-a-jour', (): string | null => {
    const annonce = misAJour ? app.getVersion() : null
    misAJour = false
    return annonce
  })

  ipcMain.handle('maj-rechercher', async (): Promise<Reponse> => {
    await rechercherMaj(false)
    if (maj.statut === 'erreur') return { ok: false, erreur: maj.erreur ?? 'Recherche de mise à jour impossible.' }
    const message = maj.statut === 'disponible'
      ? `Pointage ${maj.disponible!.version} est disponible.`
      : `Pointage est à jour (version ${app.getVersion()}).`
    return { ok: true, etat: etat(), message }
  })

  ipcMain.handle('maj-installer', async (): Promise<Reponse> => {
    if (!app.isPackaged) return { ok: false, erreur: REFUS_DEVELOPPEMENT }
    const publiee = maj.disponible
    if (!publiee) return { ok: false, erreur: 'Aucune nouvelle version à installer : lancez d’abord une recherche.' }
    try {
      changerMaj({ ...maj, statut: 'telechargement', progression: 0, erreur: undefined })
      const chemin = await telecharger(publiee.installateur, (progression) => changerMaj({ ...maj, progression }))
      changerMaj({ ...maj, statut: 'installation' })
      installer(chemin)
      return { ok: true, etat: etat(), message: `Installation de Pointage ${publiee.version} : l’application redémarre dans un instant.` }
    } catch (e) {
      const erreur = e instanceof Error ? e.message : String(e)
      changerMaj({ ...maj, statut: 'erreur', erreur })
      return { ok: false, erreur }
    }
  })

  ipcMain.handle('maj-fichier', async (): Promise<Reponse> => {
    if (!app.isPackaged) return { ok: false, erreur: REFUS_DEVELOPPEMENT }
    const choix = await ouvrirFichier({
      title: 'Installer une version de Pointage',
      filters: [{ name: 'Installateur Pointage', extensions: ['exe'] }],
      properties: ['openFile'],
    })
    const chemin = choix.filePaths[0]
    if (choix.canceled || !chemin) return { ok: true, etat: etat() }
    const nom = chemin.split(/[\\/]/).pop()!
    const version = versionDepuisNom(nom)
    if (!version) {
      return { ok: false, erreur: `« ${nom} » n’est pas un installateur de Pointage (nom attendu : Pointage-Installation-X.Y.Z.exe).` }
    }
    const ecart = comparerVersions(version, app.getVersion())
    const confirmation = await demander({
      type: ecart > 0 ? 'question' : 'warning',
      title: 'Installer une version de Pointage',
      message: ecart > 0
        ? `Installer Pointage ${version} ?`
        : `La version ${version} n’est pas plus récente que celle installée (${app.getVersion()}). L’installer quand même ?`,
      detail: 'Vos heures et réglages sont conservés. Pointage se ferme puis redémarre tout seul.',
      buttons: ['Installer', 'Annuler'],
      defaultId: ecart > 0 ? 0 : 1,
      cancelId: 1,
    })
    if (confirmation.response !== 0) return { ok: true, etat: etat() }
    changerMaj({ ...maj, statut: 'installation' })
    installer(chemin)
    return { ok: true, etat: etat(), message: `Installation de Pointage ${version} : l’application redémarre dans un instant.` }
  })

  ipcMain.handle('ouvrir-dossier', async () => {
    await shell.openPath(app.getPath('userData'))
  })
}
