// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { Etat } from '../../src/lib/api'
import { bandeauMaj, calculer, echapper, texteSoldeZero, vueApercuImport, vueAujourdhui, vueMaj, vueMois, vueReglages, vueSynthese, type Contexte } from '../../src/renderer/vue'
import { a, donnees, ev, journeeType } from '../aides'

const LUNDI = '2026-11-09'
const MARDI = '2026-11-10'

function contexte(d = donnees(), maintenant = a(MARDI, '10:00')): Contexte {
  const etat: Etat = {
    donnees: d, autostart: true, version: '0.1.0', cheminDonnees: 'C:\\données\\pointage.json', installee: true, portable: false,
    maj: { statut: 'inconnu' },
  }
  return { etat, maintenant, mois: '2026-11', ouverts: new Set() }
}

function monter(html: string): HTMLElement {
  document.body.innerHTML = html
  return document.body
}

describe('vue du mois', () => {
  it('affiche chaque jour, numéroté, avec un sous-total par semaine', () => {
    const ctx = contexte(donnees(journeeType(LUNDI)))
    const page = monter(vueMois(calculer(ctx), ctx))
    expect(page.querySelectorAll('tr.jour')).toHaveLength(30)
    expect(page.querySelectorAll('tr.semaine')).toHaveLength(6)
    const lundi = page.querySelector(`tr.jour[data-cle="${LUNDI}"]`)!
    expect(lundi.querySelector('.numero')!.textContent).toBe('9')
    expect([...lundi.querySelectorAll('.heure .valeur')].map((b) => b.textContent)).toEqual(['08:10', '12:03', '13:31', '16:58'])
    expect(lundi.querySelector('.ecart')!.textContent).toBe('-0h02')
    expect(page.querySelector(`tr.jour[data-cle="${MARDI}"]`)!.classList.contains('aujourdhui')).toBe(true)
    expect(page.querySelector('tr.jour[data-cle="2026-11-11"] .ferie')!.textContent).toBe('Armistice 1918')
  })

  it('distingue les heures corrigées et propose de revenir à l’heure détectée', () => {
    const ctx = contexte(donnees(journeeType(LUNDI), { [LUNDI]: { arrivee: '07:45' } }))
    const cellule = monter(vueMois(calculer(ctx), ctx)).querySelector(`tr[data-cle="${LUNDI}"] td[data-champ="arrivee"]`)!
    expect(cellule.querySelector('.valeur.manuel')!.textContent).toBe('07:45')
    expect(cellule.querySelector('.valeur')!.getAttribute('title')).toBe('Corrigée à la main (détectée : 08:10)')
    expect(cellule.querySelector('[data-action="retablir"]')).not.toBeNull()
  })

  it('grise l’écart des jours d’avant le début du décompte', () => {
    const d = donnees([...journeeType('2026-11-02'), ...journeeType(LUNDI)])
    d.reglages.dateDebut = LUNDI
    const ctx = contexte(d)
    const page = monter(vueMois(calculer(ctx), ctx))
    expect(page.querySelector('tr[data-cle="2026-11-02"] .ecart .hors-decompte')!.textContent).toBe('-0h02')
    expect(page.querySelector(`tr[data-cle="${LUNDI}"] .ecart .negatif`)!.textContent).toBe('-0h02')
  })

  it('marque les jours travaillés passés sans heure', () => {
    const ctx = contexte(donnees(), a('2026-11-20', '10:00'))
    const page = monter(vueMois(calculer(ctx), ctx))
    expect(page.querySelector(`tr[data-cle="${LUNDI}"]`)!.classList.contains('a-renseigner')).toBe(true)
    expect(page.querySelector('tr[data-cle="2026-11-14"]')!.classList.contains('a-renseigner')).toBe(false)
  })

  it('déplie les événements d’un jour et échappe les notes', () => {
    const ctx = contexte(donnees(journeeType(LUNDI), { [LUNDI]: { note: '<b>RDV</b>' } }))
    ctx.ouverts = new Set([LUNDI])
    const page = monter(vueMois(calculer(ctx), ctx))
    expect(page.querySelector('tr.details')!.textContent).toContain('08:10 Démarrage du PC')
    expect((page.querySelector(`tr[data-cle="${LUNDI}"] td.note input`) as HTMLInputElement).value).toBe('<b>RDV</b>')
  })
})

describe('carte du jour et synthèse', () => {
  it('montre le temps fait et le départ conseillé pendant la journée', () => {
    const ctx = contexte(donnees([...journeeType(LUNDI), ev(MARDI, '08:00', 'ouverture')]))
    const page = monter(vueAujourdhui(calculer(ctx)) + vueSynthese(calculer(ctx), ctx))
    expect(page.querySelector('.pastille')!.textContent).toBe('En cours')
    expect(page.querySelector('.horaire.fort .valeur')!.textContent).toBe('2h00')
    expect(page.querySelector('.horaire.conseil .valeur')!.textContent).toBe('16:22')
    expect(page.querySelector('.horaire.conseil .sous')!.textContent).toBe('solde à zéro : 16:24')
    expect(page.querySelector('.tuile .valeur')!.textContent).toBe('-0h02')
  })

  it('annonce l’avancement du jour au-dessus de la barre, sur toute la largeur', () => {
    const ctx = contexte(donnees([ev(MARDI, '08:00', 'ouverture')]))
    const page = monter(vueAujourdhui(calculer(ctx)))
    const avancement = page.querySelector('.aujourdhui > .avancement')!
    expect(avancement.querySelector('.avancement-texte')!.textContent!.replace(/\s+/g, ' ').trim())
      .toBe('Avancement de la journée 27 % encore 5h22')
    expect(avancement.querySelector('progress')!.getAttribute('value')).toBe('27')
    expect(page.querySelector('.horaire.fort progress')).toBeNull()
  })

  it('passe la barre au vert une fois le temps du jour atteint', () => {
    const ctx = contexte(donnees([ev(MARDI, '08:00', 'ouverture')]), a(MARDI, '16:00'))
    const page = monter(vueAujourdhui(calculer(ctx)))
    expect(page.querySelector('progress')!.classList.contains('fini')).toBe(true)
    expect(page.querySelector('.avancement-texte .discret')!.textContent).toBe('objectif dépassé de 0h38')
  })

  it('compare la semaine et le mois à leur objectif entier, pas à celui des seuls jours terminés', () => {
    const ctx = contexte(donnees([...journeeType(LUNDI), ev(MARDI, '08:00', 'ouverture')]))
    const page = monter(vueSynthese(calculer(ctx), ctx) + vueMois(calculer(ctx), ctx))
    const [, semaine, mois] = [...page.querySelectorAll('.tuile')]
    expect([...semaine.querySelectorAll('.sous')].map((s) => s.textContent)).toEqual([
      '9h20 faites sur 29h28', 'écart sur 1 jour terminé',
    ])
    // Novembre 2026 : 20 jours ouvrés hors 11 novembre (le 1er tombe un dimanche).
    expect(mois.querySelector('.sous')!.textContent).toBe(`9h20 faites sur ${Math.floor((20 * 442) / 60)}h${String((20 * 442) % 60).padStart(2, '0')}`)
    expect(page.querySelector('.mois .carte-tete > .discret')!.textContent).toBe('9h20 faites sur 147h20 · écart -0h02')
  })
})

describe('solde à zéro', () => {
  const ctx = contexte(donnees([ev(MARDI, '08:00', 'ouverture')]))
  const j = calculer(ctx).aujourdhui
  const maintenant = a(MARDI, '10:00')

  it('n’affiche une heure que si elle a un sens aujourd’hui', () => {
    expect(texteSoldeZero(j, { objectif: 0, soldeZero: a(MARDI, '16:40') }, maintenant)).toContain('16:40')
    expect(texteSoldeZero(j, { objectif: 0, soldeZero: a(MARDI, '09:00') }, maintenant)).toContain('déjà atteint')
    expect(texteSoldeZero(j, { objectif: 0, soldeZero: a('2026-11-11', '02:00') }, maintenant)).toBe('')
    expect(texteSoldeZero(j, { objectif: 0 }, maintenant)).toBe('')
  })
})

describe('import', () => {
  it('annonce les jours reconnus, ceux déjà corrigés et les lignes refusées', () => {
    const texte = '02/11/2026 9:30 12:00 13:55 17:10\n03/11/2026 8:45 17:30\n31/02/2026 9:00 17:00\n04/11/2026 congé Pont'
    const page = monter(vueApercuImport(texte, { '2026-11-03': { note: 'déjà là' } }))
    expect(page.querySelector('.ok')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '3 jours reconnus du lundi 2 novembre au mercredi 4 novembre. 1 avait déjà des corrections, remplacées pour les valeurs importées.',
    )
    expect([...page.querySelectorAll('.apercu-jours li')].map((l) => l.textContent)).toEqual([
      'lun. 02/11 09:30 – 12:00 / 13:55 – 17:10',
      'mar. 03/11 08:45 – 17:30, sans pause',
      'mer. 04/11 Congé · « Pont »',
    ])
    expect(page.querySelector('.apercu-refus li')!.textContent).toBe('Ligne 3 : date invalide « 31/02/2026 » (attendu : JJ/MM/AAAA) — 31/02/2026 9:00 17:00')
  })

  it('invite à coller des lignes tant que le champ est vide', () => {
    expect(monter(vueApercuImport('  ', {})).textContent).toContain('Collez vos lignes')
  })

  it('propose un seul bouton d’export, avec trois formats', () => {
    const page = monter(vueReglages(contexte().etat))
    expect([...page.querySelectorAll('[data-action="exporter"]')].map((b) => (b as HTMLElement).dataset.format)).toEqual(['csv', 'txt', 'json'])
    expect((page.querySelector('.menu') as HTMLElement).hidden).toBe(true)
    expect(page.querySelector('[data-action="importer"]')).not.toBeNull()
  })
})

describe('mises à jour', () => {
  const disponible = {
    version: '0.2.0', notes: '## Nouveautés\n- **Import** de fichiers texte\n- <script>', date: '2026-11-12',
    installateur: { nom: 'Pointage-Installation-0.2.0.exe', url: 'https://exemple', taille: 1 },
  }

  it('annonce une nouvelle version dans le journal et propose de l’installer dans les réglages', () => {
    const { etat } = contexte()
    etat.maj = { statut: 'disponible', disponible }
    expect(monter(bandeauMaj(etat)).querySelector('.annonce')!.textContent).toContain('Pointage 0.2.0 est disponible.')
    const page = monter(vueMaj(etat))
    expect(page.querySelector('[data-action="maj-installer"]')!.textContent).toBe('Installer la version 0.2.0')
    expect([...page.querySelectorAll('.maj-disponible li')].map((l) => l.textContent)).toEqual(['Nouveautés', 'Import de fichiers texte', '<script>'])
    expect(page.querySelector('.maj-disponible')!.textContent).toContain('publiée le 12/11/2026')
  })

  it('n’affiche rien dans le journal sans nouvelle version', () => {
    expect(bandeauMaj(contexte().etat)).toBe('')
  })

  it('montre le téléchargement et bloque les boutons pendant ce temps', () => {
    const { etat } = contexte()
    etat.maj = { statut: 'telechargement', disponible, progression: 42 }
    const page = monter(vueMaj(etat))
    expect(page.querySelector('.maj-statut')!.textContent).toBe('Téléchargement de la version 0.2.0 : 42 %')
    expect((page.querySelector('[data-action="maj-rechercher"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('affiche l’erreur de recherche', () => {
    const { etat } = contexte()
    etat.maj = { statut: 'erreur', erreur: 'GitHub injoignable.' }
    expect(monter(vueMaj(etat)).querySelector('.maj-statut.erreur')!.textContent).toBe('GitHub injoignable.')
  })
})

describe('mises à jour, version portable', () => {
  const disponible = {
    version: '0.5.0', notes: '', date: '2026-11-12',
    installateur: { nom: 'Pointage-Installation-0.5.0.exe', url: 'https://exemple', taille: 1 },
  }

  it('propose de télécharger la nouvelle version au lieu de l’installer', () => {
    const { etat } = contexte()
    etat.portable = true
    etat.maj = { statut: 'disponible', disponible }
    const page = monter(vueMaj(etat))
    expect(page.querySelector('[data-action="maj-page"]')!.textContent).toBe('Télécharger la version 0.5.0')
    expect(page.querySelector('[data-action="maj-installer"]')).toBeNull()
    expect(page.querySelector('[data-action="maj-fichier"]')).toBeNull()
    expect(page.querySelector('.carte-tete')!.textContent).toContain('Version portable : 0.1.0')
    expect(page.querySelector('.aide')!.textContent).toContain('LISEZMOI.txt')
  })

  it('garde l’installation dans la version installée', () => {
    const { etat } = contexte()
    etat.maj = { statut: 'disponible', disponible }
    const page = monter(vueMaj(etat))
    expect(page.querySelector('[data-action="maj-page"]')).toBeNull()
    expect(page.querySelector('[data-action="maj-fichier"]')).not.toBeNull()
  })

  it('rappelle de recocher le démarrage après un déplacement du dossier', () => {
    const { etat } = contexte()
    etat.portable = true
    expect(monter(vueReglages(etat)).textContent).toContain('si vous déplacez son dossier, cochez de nouveau cette case')
  })
})

describe('réglages', () => {
  it('reprend les valeurs enregistrées', () => {
    const page = monter(vueReglages(contexte().etat))
    expect((page.querySelector('#r-objectif') as HTMLInputElement).value).toBe('7h22')
    expect(page.querySelectorAll('[data-jour]:checked')).toHaveLength(5)
    expect((page.querySelector('[name="theme"]:checked') as HTMLInputElement).value).toBe('systeme')
    expect(page.querySelector('code')!.textContent).toBe('C:\\données\\pointage.json')
  })

  it('échappe le HTML', () => {
    expect(echapper(`<a href="x">'&'</a>`)).toBe('&#60;a href=&#34;x&#34;&#62;&#39;&#38;&#39;&#60;/a&#62;')
  })
})
