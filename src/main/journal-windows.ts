import { execFile } from 'node:child_process'
import type { Evenement } from '../lib/evenements'
import { analyserJournal, requeteJournal } from '../lib/journal'

/** Interroge le journal Système avec wevtutil (présent sur tout Windows, indépendant de PowerShell et de la langue). */
export function lireJournalWindows(depuis?: number): Promise<Evenement[]> {
  return new Promise((resoudre, rejeter) => {
    execFile(
      'wevtutil.exe',
      ['qe', 'System', `/q:${requeteJournal(depuis)}`, '/f:xml', '/e:Events'],
      { windowsHide: true, maxBuffer: 256 * 1024 * 1024, timeout: 60_000, encoding: 'utf8' },
      (erreur, sortie, sortieErreur) => {
        if (erreur) rejeter(new Error(sortieErreur.trim() || erreur.message))
        else resoudre(analyserJournal(sortie))
      },
    )
  })
}
