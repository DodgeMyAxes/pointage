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
  erreurLecture?: string
  maj: EtatMaj
}

export type Reponse = { ok: true; etat: Etat; message?: string } | { ok: false; erreur: string }

export interface ApiPointage {
  etat(): Promise<Etat>
  relire(): Promise<Reponse>
  saisir(cle: string, modif: ModifSaisie): Promise<Reponse>
  reglages(modif: Partial<Reglages>): Promise<Reponse>
  autostart(actif: boolean): Promise<Reponse>
  exporterCsv(): Promise<Reponse>
  sauvegarder(): Promise<Reponse>
  restaurer(): Promise<Reponse>
  testerNotification(): Promise<Reponse>
  rechercherMaj(): Promise<Reponse>
  installerMaj(): Promise<Reponse>
  installerDepuisFichier(): Promise<Reponse>
  /** Version tout juste installée par une mise à jour (une seule fois), sinon null. */
  annonceMiseAJour(): Promise<string | null>
  ouvrirDossier(): Promise<void>
  surMaj(rappel: () => void): void
}
