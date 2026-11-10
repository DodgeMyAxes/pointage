import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { charger, enregistrer } from '../../src/main/stockage'
import { donnees } from '../aides'

let dossier: string
let chemin: string

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'pointage-tests-'))
  chemin = join(dossier, 'sous-dossier', 'pointage.json')
})
afterEach(() => rmSync(dossier, { recursive: true, force: true }))

describe('stockage', () => {
  it('signale un premier lancement', () => {
    expect(charger(chemin)).toMatchObject({ nouveau: true })
  })

  it('relit ce qui a été enregistré et garde la version précédente en secours', () => {
    const premiere = donnees([{ t: 1, nature: 'ouverture' }])
    enregistrer(chemin, premiere)
    expect(existsSync(`${chemin}.bak`)).toBe(false)
    const seconde = donnees([{ t: 1, nature: 'ouverture' }, { t: 2, nature: 'veille' }])
    enregistrer(chemin, seconde)
    expect(charger(chemin)).toEqual({ donnees: seconde, nouveau: false })
    expect(existsSync(`${chemin}.bak`)).toBe(true)
    expect(existsSync(`${chemin}.tmp`)).toBe(false)
  })

  it('met de côté un fichier abîmé et reprend la copie de secours', () => {
    const d = donnees([{ t: 1, nature: 'ouverture' }])
    enregistrer(chemin, d)
    enregistrer(chemin, d)
    writeFileSync(chemin, '{ pas du json')
    const resultat = charger(chemin)
    expect(resultat.donnees).toEqual(d)
    expect(resultat.avertissement).toContain('copie de secours')
    expect(readdirSync(join(dossier, 'sous-dossier')).some((f) => f.includes('.abime-'))).toBe(true)
  })

  it('ne perd pas un fichier abîmé sans copie de secours', () => {
    enregistrer(chemin, donnees())
    writeFileSync(chemin, 'abîmé')
    const resultat = charger(chemin)
    expect(resultat.nouveau).toBe(false)
    expect(resultat.avertissement).toContain('mis de côté')
    expect(readdirSync(join(dossier, 'sous-dossier')).some((f) => f.includes('.abime-'))).toBe(true)
  })
})
