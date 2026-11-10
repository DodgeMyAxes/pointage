// Assemble l'application dans dist/ : processus principal, preload et fenêtre, plus les fichiers statiques.
import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'

const prod = process.argv.includes('--prod')
const commun = { bundle: true, sourcemap: !prod, minify: prod, target: 'es2023', logLevel: 'warning' }

rmSync('dist', { recursive: true, force: true })
await Promise.all([
  build({ ...commun, entryPoints: ['src/main/main.ts'], outfile: 'dist/main.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...commun, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...commun, entryPoints: ['src/renderer/app.ts'], outfile: 'dist/renderer/app.js', platform: 'browser', format: 'iife' }),
])
for (const fichier of ['index.html', 'style.css']) cpSync(`src/renderer/${fichier}`, `dist/renderer/${fichier}`)
mkdirSync('dist/assets', { recursive: true })
cpSync('build/icone.ico', 'dist/assets/icone.ico')
console.log(`dist/ assemblé${prod ? ' (production)' : ''}.`)
