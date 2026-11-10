// Dessine l'icône (horloge blanche sur carré bleu arrondi) et l'écrit en .ico multi-tailles et en .png.
// Rendu par champs de distance avec suréchantillonnage 4×4 : net à chaque taille, sans dépendance.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const TAILLES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const BLEU_HAUT = [59, 130, 246]
const BLEU_BAS = [29, 78, 216]
const BLANC = [255, 255, 255]
const AIGUILLE = [30, 64, 175]

// Distances signées en coordonnées normalisées (0..1), négatives à l'intérieur.
const carreArrondi = (x, y, demi, rayon) => {
  const qx = Math.abs(x - 0.5) - demi + rayon
  const qy = Math.abs(y - 0.5) - demi + rayon
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rayon
}
const disque = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r
const segment = (x, y, ax, ay, bx, by, epaisseur) => {
  const [px, py, dx, dy] = [x - ax, y - ay, bx - ax, by - ay]
  const h = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - dx * h, py - dy * h) - epaisseur / 2
}
const pointe = (angleDeg, longueur) => {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return [0.5 + Math.cos(a) * longueur, 0.5 + Math.sin(a) * longueur]
}

function couleur(x, y) {
  if (carreArrondi(x, y, 0.47, 0.2) > 0) return null
  const t = y
  let c = BLEU_HAUT.map((v, i) => v + (BLEU_BAS[i] - v) * t)
  if (disque(x, y, 0.5, 0.5, 0.33) < 0) c = BLANC
  const [mx, my] = pointe(0, 0.24) // grande aiguille sur 12
  const [hx, hy] = pointe(135, 0.16) // petite aiguille vers 4 h 30
  if (segment(x, y, 0.5, 0.5, mx, my, 0.06) < 0 || segment(x, y, 0.5, 0.5, hx, hy, 0.07) < 0 || disque(x, y, 0.5, 0.5, 0.05) < 0) {
    c = AIGUILLE
  }
  return c
}

function rendre(taille) {
  const pixels = Buffer.alloc(taille * taille * 4)
  const n = 4
  for (let py = 0; py < taille; py++) {
    for (let px = 0; px < taille; px++) {
      let [r, g, b, a] = [0, 0, 0, 0]
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const c = couleur((px + (sx + 0.5) / n) / taille, (py + (sy + 0.5) / n) / taille)
          if (!c) continue
          r += c[0]; g += c[1]; b += c[2]; a++
        }
      }
      const i = (py * taille + px) * 4
      if (a) {
        pixels[i] = Math.round(r / a)
        pixels[i + 1] = Math.round(g / a)
        pixels[i + 2] = Math.round(b / a)
        pixels[i + 3] = Math.round((a / (n * n)) * 255)
      }
    }
  }
  return png(taille, pixels)
}

const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const octet of buf) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function bloc(type, donnees) {
  const longueur = Buffer.alloc(4)
  longueur.writeUInt32BE(donnees.length)
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corps))
  return Buffer.concat([longueur, corps, crc])
}
function png(taille, pixels) {
  const entete = Buffer.alloc(13)
  entete.writeUInt32BE(taille, 0)
  entete.writeUInt32BE(taille, 4)
  entete[8] = 8 // 8 bits par canal
  entete[9] = 6 // RVBA
  const lignes = Buffer.alloc(taille * (taille * 4 + 1))
  for (let y = 0; y < taille; y++) pixels.copy(lignes, y * (taille * 4 + 1) + 1, y * taille * 4, (y + 1) * taille * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(lignes, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ])
}

function ico(images) {
  const entete = Buffer.alloc(6)
  entete.writeUInt16LE(1, 2)
  entete.writeUInt16LE(images.length, 4)
  let decalage = 6 + images.length * 16
  const entrees = images.map(({ taille, donnees }) => {
    const e = Buffer.alloc(16)
    e[0] = taille >= 256 ? 0 : taille
    e[1] = taille >= 256 ? 0 : taille
    e.writeUInt16LE(1, 4) // plans
    e.writeUInt16LE(32, 6) // bits par pixel
    e.writeUInt32LE(donnees.length, 8)
    e.writeUInt32LE(decalage, 12)
    decalage += donnees.length
    return e
  })
  return Buffer.concat([entete, ...entrees, ...images.map((i) => i.donnees)])
}

const images = TAILLES.map((taille) => ({ taille, donnees: rendre(taille) }))
mkdirSync('build', { recursive: true })
writeFileSync('build/icone.ico', ico(images))
writeFileSync('build/icone.png', images.at(-1).donnees)
console.log(`build/icone.ico (${TAILLES.join(', ')} px) et build/icone.png écrits.`)
