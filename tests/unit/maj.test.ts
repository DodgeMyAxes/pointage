import { describe, expect, it } from 'vitest'
import {
  ancienneInstallationAEffacer, comparerVersions, dossierInstallation, dossierPortable, emplacementsInstallateur, estCopieInstallee, jugerEmplacement,
  lancementRefuse, lignesNotes, lireVersionPubliee, pageVersion, rechercheHebdoDue, versionDepuisNom,
} from '../../src/lib/maj'

describe('lancement de l’installateur', () => {
  const telechargements = 'C:\\Users\\moi\\Downloads'

  it('essaie le dossier temporaire puis Téléchargements', () => {
    const temp = 'C:\\Users\\moi\\AppData\\Local\\Temp\\Pointage-mise-a-jour\\Pointage-Installation-0.5.0.exe'
    expect(emplacementsInstallateur(temp, telechargements)).toEqual([temp, 'C:\\Users\\moi\\Downloads\\Pointage-Installation-0.5.0.exe'])
  })

  it('ne copie pas un installateur déjà dans Téléchargements', () => {
    const ici = 'c:\\users\\moi\\downloads\\Pointage-Installation-0.5.0.exe'
    expect(emplacementsInstallateur(ici, telechargements)).toEqual([ici])
  })

  it('reconnaît un refus de Windows', () => {
    expect(lancementRefuse(Object.assign(new Error('spawn EPERM'), { code: 'EPERM' }))).toBe(true)
    expect(lancementRefuse({ code: 'EACCES' })).toBe(true)
    expect(lancementRefuse({ code: 'ENOENT' })).toBe(false)
    expect(lancementRefuse(null)).toBe(false)
  })
})

describe('copie installée', () => {
  const local = String.raw`C:\Users\moi\AppData\Local`
  const parUtilisateur = String.raw`${local}\Programs\pointage`
  const pourTous = String.raw`C:\Program Files\Pointage`
  const developpement = String.raw`C:\Users\moi\Documents\pointage\release\win-unpacked`
  /** Fichiers présents : un désinstalleur dans chacun des dossiers donnés. */
  const avecDesinstalleur = (...dossiers: string[]) => (chemin: string) =>
    dossiers.some((d) => chemin.toLowerCase() === `${d}\\Uninstall Pointage.exe`.toLowerCase())

  it('situe l’installation par utilisateur dans Programs\\pointage', () => {
    expect(dossierInstallation(local)).toBe(parUtilisateur)
    expect(dossierInstallation(`${local}\\`)).toBe(parUtilisateur)
  })
  it('reconnaît une copie installée à son désinstalleur, dans AppData comme dans Program Files', () => {
    const existe = avecDesinstalleur(parUtilisateur, pourTous)
    expect(estCopieInstallee(`${parUtilisateur}\\Pointage.exe`, existe)).toBe(true)
    expect(estCopieInstallee(`${pourTous}\\Pointage.exe`, existe)).toBe(true)
    expect(estCopieInstallee(`${developpement}\\Pointage.exe`, existe)).toBe(false)
  })
  it('efface l’installation par utilisateur quand Pointage tourne depuis Program Files', () => {
    const exe = `${pourTous}\\Pointage.exe`
    expect(ancienneInstallationAEffacer(exe, local, avecDesinstalleur(parUtilisateur, pourTous))).toBe(parUtilisateur)
    expect(ancienneInstallationAEffacer(exe, local, avecDesinstalleur(pourTous))).toBeUndefined()
    expect(ancienneInstallationAEffacer(exe, undefined, avecDesinstalleur(parUtilisateur, pourTous))).toBeUndefined()
  })
  it('n’efface rien depuis l’installation par utilisateur elle-même ni depuis une copie de développement', () => {
    const existe = avecDesinstalleur(parUtilisateur, pourTous)
    expect(ancienneInstallationAEffacer(`${parUtilisateur}\\Pointage.exe`, local, existe)).toBeUndefined()
    expect(ancienneInstallationAEffacer('c:/users/moi/appdata/local/programs/pointage/Pointage.exe', local, existe)).toBeUndefined()
    expect(ancienneInstallationAEffacer(`${developpement}\\Pointage.exe`, local, existe)).toBeUndefined()
  })
})

describe('version portable', () => {
  const cle = String.raw`E:\Outils\Pointage`
  const presents = (...chemins: string[]) => (chemin: string) => chemins.some((c) => c.toLowerCase() === chemin.toLowerCase())

  it('écrit dans donnees à côté de Pointage.exe quand portable.txt est présent', () => {
    expect(dossierPortable(`${cle}\\Pointage.exe`, presents(`${cle}\\portable.txt`))).toBe(`${cle}\\donnees`)
  })
  it('n’est pas portable sans le témoin', () => {
    expect(dossierPortable(`${cle}\\Pointage.exe`, presents())).toBeUndefined()
  })
  it('n’est jamais portable dans une copie installée, même avec le témoin', () => {
    const pf = String.raw`C:\Program Files\Pointage`
    expect(dossierPortable(`${pf}\\Pointage.exe`, presents(`${pf}\\portable.txt`, `${pf}\\Uninstall Pointage.exe`))).toBeUndefined()
  })
  describe('emplacement', () => {
    const env = {
      TEMP: String.raw`C:\Users\moi\AppData\Local\Temp`,
      USERPROFILE: String.raw`C:\Users\moi`,
      OneDriveCommercial: String.raw`C:\Users\moi\OneDrive - Entreprise`,
    }
    const juger = (dossier: string) => jugerEmplacement(`${dossier}\\Pointage.exe`, env)

    it('accepte le dossier personnel ou une clé USB', () => {
      expect(juger(String.raw`C:\Users\moi\Pointage`)).toEqual({})
      expect(juger(cle)).toEqual({})
    })
    it('refuse un lancement depuis l’intérieur du zip', () => {
      expect(juger(String.raw`C:\Users\moi\AppData\Local\Temp\Temp1_Pointage-Portable-0.5.0.zip\Pointage`).bloquant).toContain('extrayez')
      expect(jugerEmplacement(String.raw`D:\X\Pointage-Portable.zip\Pointage\Pointage.exe`, {}).bloquant).toBeDefined()
    })
    it('déconseille OneDrive, Téléchargements et le réseau', () => {
      expect(juger(String.raw`C:\Users\moi\OneDrive - Entreprise\Bureau\Pointage`).avertissement).toContain('OneDrive')
      expect(jugerEmplacement(String.raw`C:\Users\moi\OneDrive\Documents\Pointage\Pointage.exe`, {}).avertissement).toContain('OneDrive')
      expect(juger(String.raw`C:\Users\moi\Downloads\Pointage-Portable-0.5.0\Pointage`).avertissement).toContain('Téléchargements')
      expect(juger(String.raw`\\serveur\partage\Pointage`).avertissement).toContain('réseau')
    })
    it('ne confond pas un dossier au nom voisin', () => {
      expect(juger(String.raw`C:\Users\moi\Downloads2\Pointage`)).toEqual({})
    })
  })

  it('donne la page GitHub de la version, ou de la dernière', () => {
    expect(pageVersion('0.5.0')).toBe('https://github.com/DodgeMyAxes/pointage/releases/tag/v0.5.0')
    expect(pageVersion()).toBe('https://github.com/DodgeMyAxes/pointage/releases/latest')
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
