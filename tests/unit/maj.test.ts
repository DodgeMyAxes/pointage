import { describe, expect, it } from 'vitest'
import { comparerVersions, lignesNotes, lireVersionPubliee, versionDepuisNom } from '../../src/lib/maj'

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
