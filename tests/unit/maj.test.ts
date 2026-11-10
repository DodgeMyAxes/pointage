import { describe, expect, it } from 'vitest'
import {
  comparerVersions, dossierInstallation, estCopieInstallee, lignesNotes, lireVersionPubliee, rechercheHebdoDue, versionDepuisNom,
} from '../../src/lib/maj'

describe('copie installée', () => {
  const local = String.raw`C:\Users\moi\AppData\Local`
  it('situe l’installation dans Programs\\pointage', () => {
    expect(dossierInstallation(local)).toBe(String.raw`C:\Users\moi\AppData\Local\Programs\pointage`)
    expect(dossierInstallation(`${local}\\`)).toBe(dossierInstallation(local))
  })
  it('reconnaît l’exécutable installé, sans tenir compte de la casse ni des barres obliques', () => {
    expect(estCopieInstallee(String.raw`${local}\Programs\pointage\Pointage.exe`, local)).toBe(true)
    expect(estCopieInstallee('c:/users/moi/appdata/local/programs/Pointage/Pointage.exe', local)).toBe(true)
  })
  it('écarte une copie de développement ou un dossier voisin', () => {
    expect(estCopieInstallee(String.raw`C:\Users\moi\Documents\pointage\release\win-unpacked\Pointage.exe`, local)).toBe(false)
    expect(estCopieInstallee(String.raw`${local}\Programs\pointage-ancien\Pointage.exe`, local)).toBe(false)
    expect(estCopieInstallee(String.raw`${local}\Programs\pointage\Pointage.exe`, undefined)).toBe(false)
  })
})

const le = (j: number, h: number, m = 0) => new Date(2026, 10, j, h, m).getTime() // novembre 2026 : lundi 9, lundi 16

describe('recherche hebdomadaire', () => {
  it('est due sans recherche connue', () => {
    expect(rechercheHebdoDue(undefined, le(11, 9))).toBe(true)
  })
  it('n’a lieu qu’une fois dans la semaine', () => {
    expect(rechercheHebdoDue(le(9, 8, 30), le(9, 14))).toBe(false)
    expect(rechercheHebdoDue(le(9, 8, 30), le(13, 17))).toBe(false)
    expect(rechercheHebdoDue(le(9, 8, 30), le(15, 23))).toBe(false)
  })
  it('redevient due au premier démarrage du lundi suivant', () => {
    expect(rechercheHebdoDue(le(13, 17), le(16, 8))).toBe(true)
  })
  it('compte la nuit de dimanche à lundi avant 4 h dans la semaine finie', () => {
    expect(rechercheHebdoDue(le(13, 17), le(16, 3, 30))).toBe(false)
    expect(rechercheHebdoDue(le(16, 3, 30), le(16, 8))).toBe(true)
  })
  it('a lieu au premier jour utilisé si le lundi est chômé', () => {
    expect(rechercheHebdoDue(le(6, 9), le(10, 8))).toBe(true)
  })
  it('se refait si la date enregistrée est dans le futur (horloge corrigée)', () => {
    expect(rechercheHebdoDue(le(20, 9), le(11, 9))).toBe(true)
  })
})

const release = (surcharge: Record<string, unknown> = {}) => ({
  tag_name: 'v0.2.0',
  body: 'Notes',
  published_at: '2026-11-12T08:00:00Z',
  assets: [
    { name: 'Pointage-Installation-0.2.0.exe.blockmap', browser_download_url: 'https://x/blockmap', size: 10 },
    {
      name: 'Pointage-Installation-0.2.0.exe', browser_download_url: 'https://x/setup.exe', size: 1234,
      digest: `sha256:${'AB'.repeat(32)}`,
    },
  ],
  ...surcharge,
})

describe('versions', () => {
  it('compare numériquement, pas alphabétiquement', () => {
    expect(comparerVersions('0.10.0', '0.9.9')).toBeGreaterThan(0)
    expect(comparerVersions('1.0.0', '1.0.0')).toBe(0)
    expect(comparerVersions('0.1.0', '0.1.1')).toBeLessThan(0)
  })

  it('lit la version dans le nom d’un installateur', () => {
    expect(versionDepuisNom('Pointage-Installation-0.2.0.exe')).toBe('0.2.0')
    expect(versionDepuisNom('pointage-installation-1.10.3.EXE')).toBe('1.10.3')
    expect(versionDepuisNom('Pointage-Installation-0.2.0 (1).exe')).toBeNull()
    expect(versionDepuisNom('setup.exe')).toBeNull()
  })
})

describe('version publiée sur GitHub', () => {
  it('retient l’installateur, sa taille et son empreinte', () => {
    expect(lireVersionPubliee(release())).toEqual({
      version: '0.2.0',
      notes: 'Notes',
      date: '2026-11-12',
      installateur: { nom: 'Pointage-Installation-0.2.0.exe', url: 'https://x/setup.exe', taille: 1234, sha256: 'ab'.repeat(32) },
    })
  })

  it('refuse une version sans installateur ou au numéro invalide', () => {
    expect(() => lireVersionPubliee(release({ assets: [] }))).toThrow('La version 0.2.0 est publiée sans installateur.')
    expect(() => lireVersionPubliee(release({ tag_name: 'essai' }))).toThrow('Numéro de version publié invalide : « essai ».')
    expect(() => lireVersionPubliee(null)).toThrow('Réponse de GitHub illisible.')
  })

  it('n’accepte pas l’installateur d’une autre version', () => {
    expect(() => lireVersionPubliee(release({ tag_name: 'v0.3.0' }))).toThrow('sans installateur')
  })

  it('simplifie les notes Markdown en lignes', () => {
    expect(lignesNotes('## Nouveautés\n\n- **Import** CSV\n* `txt` aussi\n')).toEqual(['Nouveautés', 'Import CSV', 'txt aussi'])
  })
})
