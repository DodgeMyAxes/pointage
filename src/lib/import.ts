/**
 * Import d'heures en masse, depuis un texte collé ou un fichier :
 * - texte : une ligne par jour, « 02/11/2026 9:30 12:00 13:55 17:10 » ; deux heures = arrivée et départ sans pause ;
 *   un type (« congé », « férié »…) et une note peuvent suivre (« 06/11/2026 congé Pont ») ;
 * - CSV : séparateur « ; », « , » ou tabulation, avec une ligne d'en-tête qui nomme les colonnes (Date, Arrivée,
 *   Pause, Reprise, Départ, Type, Note, Matin, Après-midi ; les autres sont ignorées), comme l'export de Pointage.
 * Les lignes vides et celles qui commencent par « # » sont ignorées.
 */
import { appliquerSaisie, LIBELLES_TYPES, TYPES, type Donnees, type ModifSaisie, type TypeJour } from './donnees'
import { cleJour, ecrireHeure, estCleJour, lireHeure } from './temps'

export interface JourImporte {
  ligne: number
  cle: string
  modif: ModifSaisie
}

export interface RefusImport {
  ligne: number
  texte: string
  raison: string
}

export interface ResultatImport {
  format: 'texte' | 'csv'
  jours: JourImporte[]
  refus: RefusImport[]
}

const sansAccents = (texte: string) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Mots reconnus pour le type de jour (sans accents, en minuscules). */
const MOTS_TYPES: Record<string, TypeJour> = {
  travail: 'travail',
  recup: 'recup', recuperation: 'recup',
  demi: 'demi', 'demi-journee': 'demi', demijournee: 'demi',
  conge: 'conge', conges: 'conge', cp: 'conge', vacances: 'conge',
  ferie: 'ferie',
  absence: 'absence', maladie: 'absence',
  repos: 'repos',
}
for (const t of TYPES) MOTS_TYPES[sansAccents(LIBELLES_TYPES[t])] = t

export function lireType(mot: string): TypeJour | undefined {
  return MOTS_TYPES[sansAccents(mot)]
}

/** « 02/11/2026 », « 2/11/26 », « 02-11-2026 », « 02.11.2026 » ou « 2026-11-02 » → clé du jour ; null si invalide. */
export function lireDate(texte: string): string | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(texte.trim())
  let annee: number, mois: number, jour: number
  if (m) [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(texte.trim())
    if (!m) return null
    ;[jour, mois, annee] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (annee < 100) annee += 2000
  }
  const cle = cleJour(new Date(annee, mois - 1, jour))
  return estCleJour(cle) && cle === `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}` ? cle : null
}

/** Heures dans l'ordre → modification des quatre champs (deux heures : pas de pause). */
function heures(valeurs: number[]): ModifSaisie | string {
  for (let i = 1; i < valeurs.length; i++) {
    if (valeurs[i] <= valeurs[i - 1]) return 'heures dans le désordre'
  }
  const h = valeurs.map(ecrireHeure)
  if (h.length === 2) return { arrivee: h[0], pause: '', reprise: '', depart: h[1] }
  if (h.length === 4) return { arrivee: h[0], pause: h[1], reprise: h[2], depart: h[3] }
  return `${h.length} heure${h.length > 1 ? 's' : ''} : il en faut 2 (arrivée, départ) ou 4 (arrivée, pause, reprise, départ)`
}

function ligneTexte(texte: string): ModifSaisie & { cle?: string } | string {
  const morceaux = texte.trim().split(/[\s;,\t]+/)
  const cle = lireDate(morceaux[0])
  if (!cle) return `date invalide « ${morceaux[0]} » (attendu : JJ/MM/AAAA)`
  const valeurs: number[] = []
  let i = 1
  for (; i < morceaux.length && /^\d/.test(morceaux[i]); i++) {
    const min = lireHeure(morceaux[i])
    if (min === null) return `heure invalide « ${morceaux[i]} »`
    valeurs.push(min)
  }
  let modif: ModifSaisie = {}
  if (valeurs.length) {
    const h = heures(valeurs)
    if (typeof h === 'string') return h
    modif = h
  }
  const type = i < morceaux.length ? lireType(morceaux[i]) : undefined
  if (type) {
    modif.type = type
    i++
  }
  // La note reprend le texte d'origine (espaces compris) après les éléments reconnus.
  if (i < morceaux.length) {
    const debut = texte.indexOf(morceaux[i], texte.indexOf(morceaux[i - 1]) + morceaux[i - 1].length)
    modif.note = texte.slice(debut).trim()
  }
  if (!Object.keys(modif).length) return 'ni heure, ni type, ni note'
  return { cle, ...modif }
}

/** Découpe une ligne CSV en cellules, guillemets compris. */
export function cellulesCsv(ligne: string, separateur: string): string[] {
  const cellules: string[] = []
  let courant = ''
  let guillemets = false
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]
    if (guillemets) {
      if (c === '"' && ligne[i + 1] === '"') {
        courant += '"'
        i++
      } else if (c === '"') guillemets = false
      else courant += c
    } else if (c === '"') guillemets = true
    else if (c === separateur) {
      cellules.push(courant)
      courant = ''
    } else courant += c
  }
  cellules.push(courant)
  return cellules.map((x) => x.trim())
}

const COLONNES = ['date', 'arrivee', 'pause', 'reprise', 'depart', 'type', 'note', 'matin', 'apres-midi'] as const
type Colonne = (typeof COLONNES)[number]

/** En-tête CSV reconnu : séparateur et position des colonnes utiles ; null si la ligne n'en est pas un. */
function enteteCsv(ligne: string): { separateur: string; colonnes: Partial<Record<Colonne, number>> } | null {
  const separateur = [';', '\t', ','].find((s) => ligne.includes(s))
  if (!separateur) return null
  const noms = cellulesCsv(ligne, separateur).map(sansAccents)
  if (!noms.includes('date')) return null
  const colonnes: Partial<Record<Colonne, number>> = {}
  for (const col of COLONNES) {
    const i = noms.indexOf(col)
    if (i >= 0) colonnes[col] = i
  }
  return { separateur, colonnes }
}

function ligneCsv(cellules: string[], colonnes: Partial<Record<Colonne, number>>): ModifSaisie & { cle?: string } | string {
  const valeur = (col: Colonne) => (colonnes[col] === undefined ? '' : (cellules[colonnes[col]!] ?? ''))
  const cle = lireDate(valeur('date'))
  if (!cle) return `date invalide « ${valeur('date')} » (attendu : JJ/MM/AAAA)`
  const modif: ModifSaisie = {}
  const presentes: number[] = []
  for (const champ of ['arrivee', 'pause', 'reprise', 'depart'] as const) {
    const v = valeur(champ)
    if (!v) continue
    const min = lireHeure(v)
    if (min === null) return `heure invalide « ${v} »`
    modif[champ] = ecrireHeure(min)
    presentes.push(min)
  }
  if (presentes.some((m, i) => i > 0 && m <= presentes[i - 1])) return 'heures dans le désordre'
  if ((modif.pause === undefined) !== (modif.reprise === undefined)) return 'pause sans reprise (ou l’inverse)'
  if (modif.arrivee && modif.depart && modif.pause === undefined) Object.assign(modif, { pause: '', reprise: '' })
  const type = valeur('type')
  if (type) {
    const t = lireType(type)
    if (!t) return `type de jour inconnu « ${type} »`
    modif.type = t
  }
  if (valeur('note')) modif.note = valeur('note')
  if (valeur('matin')) modif.matin = valeur('matin')
  if (valeur('apres-midi')) modif.apresMidi = valeur('apres-midi')
  if (!Object.keys(modif).length) return 'ni heure, ni type, ni note'
  return { cle, ...modif }
}

export function analyserImport(texte: string): ResultatImport {
  const lignes = texte.replace(/^﻿/, '').split(/\r?\n/)
  const premiere = lignes.findIndex((l) => l.trim() && !l.trim().startsWith('#'))
  const entete = premiere >= 0 ? enteteCsv(lignes[premiere]) : null
  const res: ResultatImport = { format: entete ? 'csv' : 'texte', jours: [], refus: [] }
  const vus = new Map<string, number>()
  lignes.forEach((brute, i) => {
    const ligne = brute.trim()
    if (!ligne || ligne.startsWith('#') || (entete && i === premiere)) return
    const lu = entete ? ligneCsv(cellulesCsv(ligne, entete.separateur), entete.colonnes) : ligneTexte(ligne)
    if (typeof lu === 'string') {
      res.refus.push({ ligne: i + 1, texte: ligne, raison: lu })
      return
    }
    const { cle, ...modif } = lu
    if (vus.has(cle!)) {
      res.refus.push({ ligne: i + 1, texte: ligne, raison: `jour déjà présent ligne ${vus.get(cle!)}` })
      return
    }
    vus.set(cle!, i + 1)
    res.jours.push({ ligne: i + 1, cle: cle!, modif })
  })
  res.jours.sort((a, b) => a.cle.localeCompare(b.cle))
  return res
}

/** Applique les jours importés ; les heures importées deviennent des corrections manuelles. */
export function appliquerImport(donnees: Donnees, jours: readonly JourImporte[]): Donnees {
  return jours.reduce((d, j) => appliquerSaisie(d, j.cle, j.modif), donnees)
}
