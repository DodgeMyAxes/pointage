/** Contrat entre la fenêtre et le processus principal (exposé par preload.ts sous `window.pointage`). */
import type { Donnees, ModifSaisie, Reglages } from './donnees'
import type { EtatMaj } from './maj'

export interface Etat {
  donnees: Donnees
  /** Lancement à l'ouverture de session Windows. */
  autostart: boolean
  version: string
  cheminDonnees: string
  /** Application installée (et non lancée depuis les sources). */
  installee: boolean
  /** Version portable (zip) : données à côté de Pointage.exe, mises à jour à télécharger à la main. */
  portable: boolean
  erreurLecture?: string
  maj: EtatMaj
}

export type Reponse = { ok: true; etat: Etat; message?: string } | { ok: false; erreur: string }

export type FormatExport = 'csv' | 'txt' | 'json'

/** Fichier choisi pour l'import : texte à prévisualiser, ou sauvegarde JSON déjà restaurée par le processus principal. */
export type FichierImport =
  | { type: 'annule' }
  | { type: 'texte'; nom: string; texte: string }
  | { type: 'restauration'; reponse: Reponse }
  | { type: 'erreur'; erreur: string }

export interface ApiPointage {
  etat(): Promise<Etat>
  relire(): Promise<Reponse>
  saisir(cle: string, modif: ModifSaisie): Promise<Reponse>
  reglages(modif: Partial<Reglages>): Promise<Reponse>
  autostart(actif: boolean): Promise<Reponse>
  exporter(format: FormatExport): Promise<Reponse>
  choisirFichierImport(): Promise<FichierImport>
  importerJours(texte: string): Promise<Reponse>
  testerNotification(): Promise<Reponse>
  rechercherMaj(): Promise<Reponse>
  installerMaj(): Promise<Reponse>
  installerDepuisFichier(): Promise<Reponse>
  /** Ouvre dans le navigateur la page GitHub de la version disponible (version portable). */
  ouvrirPageMaj(): Promise<void>
  /** Version tout juste installée par une mise à jour (une seule fois), sinon null. */
  annonceMiseAJour(): Promise<string | null>
  ouvrirDossier(): Promise<void>
  surMaj(rappel: () => void): void
}
