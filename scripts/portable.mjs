/**
 * Version portable : zip de release/win-unpacked (assemblé par electron-builder) avec le fichier témoin
 * portable.txt (données dans « donnees » à côté de Pointage.exe) et le mode d'emploi LISEZMOI.txt.
 * Résultat : release/Pointage-Portable-X.Y.Z.zip, qui contient un dossier « Pointage ».
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const racine = join(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'))
const source = join(racine, 'release', 'win-unpacked')
const travail = join(racine, 'release', 'portable')
const dossier = join(travail, 'Pointage')
const zip = join(racine, 'release', `Pointage-Portable-${version}.zip`)

if (!existsSync(join(source, 'Pointage.exe'))) throw new Error(`Pointage.exe introuvable dans ${source} : lancez d’abord electron-builder.`)

rmSync(travail, { recursive: true, force: true })
rmSync(zip, { force: true })
cpSync(source, dossier, { recursive: true })
// Bloc-notes lit l'UTF-8 sans BOM, mais une BOM rend les accents sûrs partout ; fins de ligne Windows.
const texteWindows = (texte) => '\uFEFF' + texte.replace(/\r?\n/g, '\r\n')
writeFileSync(join(dossier, 'portable.txt'), texteWindows(
  'Ce fichier fait de Pointage une version portable : vos heures sont enregistrées dans le dossier « donnees » à côté de Pointage.exe.\n'
  + 'Ne le supprimez pas (sinon Pointage écrit dans %APPDATA%\\Pointage).\n',
))
const lisezmoi = texteWindows(readFileSync(join(racine, 'build', 'portable', 'LISEZMOI.txt'), 'utf8').replaceAll('{VERSION}', version))
writeFileSync(join(dossier, 'LISEZMOI.txt'), lisezmoi)
// Aussi publié à côté du zip : le mode d'emploi se lit avant de télécharger et d'ouvrir le zip.
writeFileSync(join(racine, 'release', `Pointage-Portable-LISEZMOI.txt`), lisezmoi)

// tar de Windows (bsdtar) sait écrire un zip ; celui de Git Bash (GNU tar) non : chemin complet.
const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
execFileSync(tar, ['-a', '-c', '-f', zip, '-C', travail, 'Pointage'], { stdio: 'inherit' })
rmSync(travail, { recursive: true, force: true })
console.log(`Version portable : ${zip}`)
