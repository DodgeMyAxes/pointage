/** Câblage de la fenêtre : état, rendu, actions de l'utilisateur. */
import type { ApiPointage, Etat, FormatExport, Reponse } from '../lib/api'
import { LIBELLES_CHAMPS, LIBELLES_THEMES, LIBELLES_TYPES, type Champ, type Reglages, type Theme, type TypeJour } from '../lib/donnees'
import { ajouterMois, cleJourneeDe, heureDe, lireDuree, lireHeure, nomJourLong } from '../lib/temps'
import { analyserImport } from '../lib/import'
import { bandeauMaj, calculer, capitaliser, vueApercuImport, vueAujourdhui, vueImport, vueMois, vueReglages, vueSynthese, type Contexte } from './vue'

declare global {
  interface Window {
    pointage: ApiPointage
  }
}

const api = window.pointage
const $ = <T extends HTMLElement>(selecteur: string) => document.querySelector<T>(selecteur)!

let etat: Etat
let vue: 'journal' | 'reglages' = 'journal'
let mois = cleJourneeDe(Date.now()).slice(0, 7)
const ouverts = new Set<string>()
/** Une saisie est en cours : on ne redessine pas sous les doigts de l'utilisateur. */
let edition = false
let rendreApresEdition = false

// --- Messages ----------------------------------------------------------------------------------------------

function toast(message: string, erreur = false): void {
  const el = document.createElement('div')
  el.className = `toast${erreur ? ' erreur' : ''}`
  el.setAttribute('role', erreur ? 'alert' : 'status')
  el.textContent = message
  $('#toasts').append(el)
  setTimeout(() => el.classList.add('sortie'), erreur ? 6000 : 3200)
  setTimeout(() => el.remove(), erreur ? 6400 : 3600)
}

async function appliquer(reponse: Promise<Reponse>, message?: string): Promise<boolean> {
  const r = await reponse
  if (!r.ok) {
    toast(r.erreur, true)
    rendre()
    return false
  }
  etat = r.etat
  rendre()
  const texte = r.message ?? message
  if (texte) toast(texte)
  return true
}

// --- Rendu -------------------------------------------------------------------------------------------------

function contexte(): Contexte {
  return { etat, maintenant: Date.now(), mois, ouverts }
}

function rendre(): void {
  if (edition) {
    rendreApresEdition = true
    return
  }
  const ctx = contexte()
  document.querySelectorAll<HTMLButtonElement>('[data-vue]').forEach((b) => b.classList.toggle('actif', b.dataset.vue === vue))
  const lecture = etat.donnees.derniereLecture
  $('#lecture').textContent = lecture ? `Journal Windows lu à ${heureDe(lecture)}` : ''
  const bandeau = $('#bandeau')
  bandeau.hidden = !etat.erreurLecture
  bandeau.textContent = etat.erreurLecture ?? ''

  const contenu = $('#contenu')
  const defilement = contenu.querySelector('.defilement')?.scrollTop ?? 0
  if (vue === 'reglages') contenu.innerHTML = vueReglages(etat)
  else {
    const c = calculer(ctx)
    contenu.innerHTML = bandeauMaj(etat) + vueAujourdhui(c) + vueSynthese(c, ctx) + vueMois(c, ctx)
    const zone = contenu.querySelector('.defilement')
    if (zone) zone.scrollTop = defilement
  }
}

async function rafraichir(): Promise<void> {
  etat = await api.etat()
  rendre()
}

// --- Journal : heures, type, note --------------------------------------------------------------------------

const cleDe = (el: Element) => el.closest<HTMLElement>('[data-cle]')!.dataset.cle!

function editerHeure(cellule: HTMLTableCellElement): void {
  const cle = cleDe(cellule)
  const champ = cellule.dataset.champ as Champ
  const actuelle = cellule.querySelector('.valeur')?.textContent ?? ''
  const valeurInitiale = lireHeure(actuelle) === null ? '' : actuelle
  const champSaisie = document.createElement('input')
  champSaisie.type = 'time'
  champSaisie.value = valeurInitiale
  champSaisie.setAttribute('aria-label', `${LIBELLES_CHAMPS[champ]} du ${nomJourLong(cle)}`)
  cellule.replaceChildren(champSaisie)
  edition = true
  champSaisie.focus()

  let fini = false
  const terminer = async (valider: boolean) => {
    if (fini) return
    fini = true
    edition = false
    const valeur = champSaisie.value
    if (!valider || valeur === valeurInitiale) {
      rendreApresEdition = false
      rendre()
      return
    }
    const nom = `${capitaliser(LIBELLES_CHAMPS[champ])} du ${nomJourLong(cle)}`
    await appliquer(
      api.saisir(cle, { [champ]: valeur }),
      valeur ? `${nom} : ${valeur}.` : `${nom} : aucune.`,
    )
  }
  champSaisie.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void terminer(true)
    else if (e.key === 'Escape') void terminer(false)
  })
  champSaisie.addEventListener('blur', () => void terminer(true))
}

async function retablirHeure(cellule: HTMLTableCellElement): Promise<void> {
  const cle = cleDe(cellule)
  const champ = cellule.dataset.champ as Champ
  const nom = `${capitaliser(LIBELLES_CHAMPS[champ])} du ${nomJourLong(cle)}`
  const ok = await appliquer(api.saisir(cle, { [champ]: null }))
  if (!ok) return
  const ligne = document.querySelector(`tr.jour[data-cle="${cle}"] td[data-champ="${champ}"] .valeur`)
  const detectee = ligne?.textContent ?? ''
  toast(lireHeure(detectee) === null ? `${nom} : retour à la détection (rien de détecté).` : `${nom} : retour à l’heure détectée (${detectee}).`)
}

// --- Réglages ----------------------------------------------------------------------------------------------

async function changerReglage(champ: HTMLInputElement): Promise<void> {
  const cle = champ.dataset.reglage as keyof Reglages
  const valeur = champ.value
  let modif: Partial<Reglages>
  let message: string
  switch (cle) {
    case 'objectif': {
      const duree = lireDuree(valeur)
      if (duree === null || duree <= 0) return erreurReglage(`Temps de travail par jour invalide : « ${valeur} » (exemple : 7h22).`)
      modif = { objectif: duree }
      message = `Temps de travail par jour : ${valeur.trim()}.`
      break
    }
    case 'soldeInitial': {
      const duree = lireDuree(valeur)
      if (duree === null) return erreurReglage(`Solde de départ invalide : « ${valeur} » (exemple : +3h15).`)
      modif = { soldeInitial: duree }
      message = `Solde de départ : ${valeur.trim()}.`
      break
    }
    case 'pauseDebut':
    case 'pauseFin':
      modif = { [cle]: valeur }
      message = `${cle === 'pauseDebut' ? 'Début' : 'Fin'} de la plage de pause : ${valeur}.`
      break
    case 'pauseMin':
    case 'pausePrevue':
      modif = { [cle]: Number(valeur) }
      message = `${cle === 'pauseMin' ? 'Pause minimale' : 'Pause prévue'} : ${valeur} minutes.`
      break
    case 'dateDebut':
      modif = { dateDebut: valeur }
      message = valeur ? `Décompte à partir du ${nomJourLong(valeur)}.` : 'Tous les jours connus sont comptés.'
      break
    case 'notifier':
      modif = { notifier: champ.checked }
      message = champ.checked ? 'Notification activée.' : 'Notification désactivée.'
      break
    case 'majAuto':
      modif = { majAuto: champ.checked }
      message = champ.checked ? 'Recherche automatique des mises à jour activée.' : 'Recherche automatique des mises à jour désactivée.'
      break
    case 'theme':
      modif = { theme: valeur as Theme }
      message = `Thème : ${LIBELLES_THEMES[valeur as Theme]}.`
      break
    default:
      return
  }
  await appliquer(api.reglages(modif), message)
}

function erreurReglage(message: string): void {
  toast(message, true)
  rendre()
}

async function changerJours(): Promise<void> {
  const jours = [...document.querySelectorAll<HTMLInputElement>('[data-jour]')].filter((c) => c.checked).map((c) => Number(c.dataset.jour))
  await appliquer(api.reglages({ joursTravailles: jours }), `Jours travaillés : ${jours.length} par semaine.`)
}

// --- Export et import --------------------------------------------------------------------------------------

function menuExport(ouvrir: boolean): void {
  const menu = document.querySelector<HTMLElement>('.menu')
  const bouton = document.querySelector<HTMLElement>('[data-action="menu-export"]')
  if (!menu || !bouton || menu.hidden === !ouvrir) return
  menu.hidden = !ouvrir
  bouton.setAttribute('aria-expanded', String(ouvrir))
  // Menu ouvert : pas de redessin qui le refermerait sous la souris.
  edition = ouvrir
  if (ouvrir) menu.querySelector<HTMLElement>('button')?.focus()
  else if (rendreApresEdition) {
    rendreApresEdition = false
    rendre()
  }
}

const champImport = () => document.querySelector<HTMLTextAreaElement>('#texte-import')

function ouvrirImport(): void {
  $('#modale').innerHTML = vueImport()
  champImport()!.focus()
}

function fermerImport(): void {
  $('#modale').replaceChildren()
}

/** Aperçu redessiné à chaque frappe, sans toucher au champ de texte. */
function majApercuImport(): void {
  const texte = champImport()?.value ?? ''
  $('#apercu-import').innerHTML = vueApercuImport(texte, etat.donnees.saisies)
  const n = analyserImport(texte).jours.length
  const bouton = $<HTMLButtonElement>('[data-action="valider-import"]')
  bouton.disabled = n === 0
  bouton.textContent = n ? `Importer ${n} jour${n > 1 ? 's' : ''}` : 'Importer'
}

async function fichierImport(): Promise<void> {
  const fichier = await api.choisirFichierImport()
  if (fichier.type === 'erreur') toast(fichier.erreur, true)
  else if (fichier.type === 'restauration') {
    if (await appliquer(Promise.resolve(fichier.reponse))) fermerImport()
  } else if (fichier.type === 'texte') {
    champImport()!.value = fichier.texte
    majApercuImport()
    toast(`« ${fichier.nom} » chargé : vérifiez l’aperçu avant d’importer.`)
  }
}

async function validerImport(): Promise<void> {
  if (await appliquer(api.importerJours(champImport()?.value ?? ''))) fermerImport()
}

// --- Branchements ------------------------------------------------------------------------------------------

document.addEventListener('click', (e) => {
  // Un clic ailleurs referme le menu d'export.
  if (!(e.target as HTMLElement).closest('.menu-conteneur')) menuExport(false)
  const cible = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-vue]')
  if (!cible) return
  if (cible.dataset.vue) {
    vue = cible.dataset.vue as typeof vue
    rendre()
    return
  }
  switch (cible.dataset.action) {
    case 'relire':
      void appliquer(api.relire())
      break
    case 'mois-precedent':
      mois = ajouterMois(mois, -1)
      rendre()
      break
    case 'mois-suivant':
      mois = ajouterMois(mois, 1)
      rendre()
      break
    case 'mois-courant':
      mois = cleJourneeDe(Date.now()).slice(0, 7)
      rendre()
      break
    case 'details': {
      const cle = cleDe(cible)
      if (ouverts.has(cle)) ouverts.delete(cle)
      else ouverts.add(cle)
      rendre()
      break
    }
    case 'editer':
      editerHeure(cible.closest('td')!)
      break
    case 'retablir':
      void retablirHeure(cible.closest('td')!)
      break
    case 'debut-tout':
      void appliquer(api.reglages({ dateDebut: '' }), 'Tous les jours connus sont comptés.')
      break
    case 'menu-export':
      menuExport(cible.getAttribute('aria-expanded') !== 'true')
      break
    case 'exporter':
      menuExport(false)
      void appliquer(api.exporter(cible.dataset.format as FormatExport))
      break
    case 'importer':
      ouvrirImport()
      break
    case 'fermer-import':
      fermerImport()
      break
    case 'fichier-import':
      void fichierImport()
      break
    case 'valider-import':
      void validerImport()
      break
    case 'maj-rechercher':
      void appliquer(api.rechercherMaj())
      break
    case 'maj-installer':
      void appliquer(api.installerMaj())
      break
    case 'maj-fichier':
      void appliquer(api.installerDepuisFichier())
      break
    case 'maj-page':
      void api.ouvrirPageMaj()
      break
    case 'tester-notification':
      void appliquer(api.testerNotification())
      break
    case 'ouvrir-dossier':
      void api.ouvrirDossier()
      break
  }
})

document.addEventListener('change', (e) => {
  const cible = e.target as HTMLElement
  if (cible instanceof HTMLSelectElement && cible.classList.contains('type')) {
    const cle = cleDe(cible)
    const type = cible.value as TypeJour
    void appliquer(api.saisir(cle, { type }), `${capitaliser(nomJourLong(cle))} : ${LIBELLES_TYPES[type]}.`)
  } else if (cible instanceof HTMLInputElement && cible.closest('td.note')) {
    const cle = cleDe(cible)
    const note = cible.value.trim()
    void appliquer(api.saisir(cle, { note }), note ? `Note du ${nomJourLong(cle)} enregistrée.` : `Note du ${nomJourLong(cle)} effacée.`)
  } else if (cible instanceof HTMLInputElement && cible.dataset.action === 'autostart') {
    void appliquer(api.autostart(cible.checked))
  } else if (cible instanceof HTMLInputElement && cible.dataset.jour) {
    void changerJours()
  } else if (cible instanceof HTMLInputElement && cible.dataset.reglage) {
    void changerReglage(cible)
  }
})

// Pas de redessin pendant la frappe d'une note ou d'un réglage.
document.addEventListener('focusin', (e) => {
  const cible = e.target as HTMLElement
  if (cible.matches('td.note input, [data-reglage]:not([type="checkbox"]):not([type="radio"])')) edition = true
})
document.addEventListener('focusout', (e) => {
  const cible = e.target as HTMLElement
  if (!cible.matches('td.note input, [data-reglage]:not([type="checkbox"]):not([type="radio"])')) return
  // Laisse passer l'événement « change » qui suit la perte du focus.
  setTimeout(() => {
    edition = false
    if (rendreApresEdition) {
      rendreApresEdition = false
      rendre()
    }
  }, 0)
})
document.addEventListener('input', (e) => {
  if ((e.target as HTMLElement).id === 'texte-import') majApercuImport()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('#modale').childElementCount) fermerImport()
    menuExport(false)
  }
  const cible = e.target as HTMLElement
  if (e.key === 'Enter' && cible instanceof HTMLInputElement && cible.matches('td.note input, [data-reglage]')) cible.blur()
})

api.surMaj(() => void rafraichir())
// Les durées de la journée en cours avancent toutes seules.
setInterval(() => {
  if (etat) rendre()
}, 30_000)

void rafraichir().then(async () => {
  const version = await api.annonceMiseAJour()
  if (version) toast(`Pointage a été mis à jour en version ${version}.`)
})
