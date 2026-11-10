import { contextBridge, ipcRenderer } from 'electron'
import type { ApiPointage } from './lib/api'

const api: ApiPointage = {
  etat: () => ipcRenderer.invoke('etat'),
  relire: () => ipcRenderer.invoke('relire'),
  saisir: (cle, modif) => ipcRenderer.invoke('saisir', cle, modif),
  reglages: (modif) => ipcRenderer.invoke('reglages', modif),
  autostart: (actif) => ipcRenderer.invoke('autostart', actif),
  exporterCsv: () => ipcRenderer.invoke('exporter-csv'),
  sauvegarder: () => ipcRenderer.invoke('sauvegarder'),
  restaurer: () => ipcRenderer.invoke('restaurer'),
  testerNotification: () => ipcRenderer.invoke('tester-notification'),
  rechercherMaj: () => ipcRenderer.invoke('maj-rechercher'),
  installerMaj: () => ipcRenderer.invoke('maj-installer'),
  installerDepuisFichier: () => ipcRenderer.invoke('maj-fichier'),
  annonceMiseAJour: () => ipcRenderer.invoke('annonce-mise-a-jour'),
  ouvrirDossier: () => ipcRenderer.invoke('ouvrir-dossier'),
  surMaj: (rappel) => {
    ipcRenderer.on('maj', () => rappel())
  },
}

contextBridge.exposeInMainWorld('pointage', api)
