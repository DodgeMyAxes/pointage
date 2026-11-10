/** Rendu HTML de la fenêtre. Fonctions pures : l'état entre, du HTML sort (les événements sont dans app.ts). */
import type { Etat } from '../lib/api'
import {
  avancement, bilan, calculerJour, calculerPeriode, departConseille, historique, solde, transitions,
  type Avancement, type Conseil, type Jour,
} from '../lib/calcul'
import { CHAMPS, LIBELLES_THEMES, LIBELLES_TYPES, THEMES, TYPES, type Champ } from '../lib/donnees'
import { LIBELLES_NATURES } from '../lib/evenements'
import { DEPOT, lignesNotes } from '../lib/maj'
import {
  DEBUT_JOURNEE, ajouterJours, cleJourneeDe, ecrireHeure, formatDuree, heureDe, instant, joursDuMois, jourSemaine,
  lundiDe, nomJourCourt, nomJourLong, nomMois, numeroSemaine,
} from '../lib/temps'

export interface Contexte {
  etat: Etat
  maintenant: number
  /** Mois affiché, « AAAA-MM ». */
  mois: string
  /** Jours dont le détail des événements est déplié. */
  ouverts: ReadonlySet<string>
}

export interface Calculs {
  maintenant: number
  aujourdhui: Jour
  conseil: Conseil | null
  solde: number
  semaine: Avancement
  joursMois: Jour[]
  bilanMois: Avancement
  premier?: string
}

export function calculer(ctx: Contexte): Calculs {
  const { donnees } = ctx.etat
  const trans = transitions(donnees.evenements)
  const jours = historique(donnees, ctx.maintenant, trans)
  const cleAujourdhui = cleJourneeDe(ctx.maintenant)
  const aujourdhui = calculerJour(cleAujourdhui, trans, donnees, ctx.maintenant)
  const soldeTotal = solde(donnees, jours)
  const lundi = lundiDe(cleAujourdhui)
  const joursMois = calculerPeriode(donnees, `${ctx.mois}-01`, joursDuMois(ctx.mois).at(-1)!, ctx.maintenant, trans)
  return {
    maintenant: ctx.maintenant,
    aujourdhui,
    conseil: departConseille(aujourdhui, donnees.reglages, soldeTotal, ctx.maintenant),
    solde: soldeTotal,
    semaine: avancement(calculerPeriode(donnees, lundi, ajouterJours(lundi, 6), ctx.maintenant, trans), donnees.reglages.dateDebut),
    joursMois,
    bilanMois: avancement(joursMois, donnees.reglages.dateDebut),
    premier: jours[0]?.cle,
  }
}

export function echapper(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export const capitaliser = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1)

const classeEcart = (ecart: number) => (ecart > 0 ? 'positif' : ecart < 0 ? 'negatif' : 'neutre')

// --- Aujourd'hui -------------------------------------------------------------------------------------------

const LIBELLES_HORAIRES: Record<Champ, string> = { arrivee: 'Arrivée', pause: 'Pause', reprise: 'Reprise', depart: 'Départ' }

/** Heure de départ qui ramène le solde à zéro, seulement si elle a un sens aujourd'hui. */
export function texteSoldeZero(j: Jour, conseil: Conseil, maintenant: number): string {
  const t = conseil.soldeZero
  if (t === undefined || t >= instant(ajouterJours(j.cle, 1), 0)) return ''
  return `<span class="sous">solde à zéro : ${t <= maintenant ? 'déjà atteint' : heureDe(t)}</span>`
}

export function vueAujourdhui(c: Calculs): string {
  const j = c.aujourdhui
  const horaires = CHAMPS.map((champ) => {
    const m = j[champ]
    return `<div class="horaire${m?.manuel ? ' manuel' : ''}">
      <span class="etiquette">${LIBELLES_HORAIRES[champ]}</span>
      <span class="valeur">${m ? heureDe(m.t) : '—'}</span>
    </div>`
  }).join('')

  const travaille = j.travaille ?? 0
  let pastille = ''
  if (j.statut === 'en-cours') pastille = travaille >= j.attendu && j.attendu > 0 ? '<span class="pastille ok">Journée faite</span>' : '<span class="pastille actif">En cours</span>'
  else if (j.statut === 'complet' && j.attendu === 0 && !j.arrivee) pastille = `<span class="pastille">${LIBELLES_TYPES[j.type]}</span>`
  else if (j.statut === 'complet') pastille = '<span class="pastille">Terminée</span>'
  else if (j.statut === 'incomplet') pastille = `<span class="pastille alerte">${echapper(j.alerte ?? 'Incomplet')}</span>`

  let conseil = ''
  if (c.conseil) {
    const reste = j.attendu - travaille
    conseil = `<div class="horaire conseil">
      <span class="etiquette">${reste > 0 ? 'Départ conseillé' : 'Temps du jour atteint'}</span>
      <span class="valeur">${heureDe(c.conseil.objectif)}</span>
      ${texteSoldeZero(j, c.conseil, c.maintenant)}
    </div>`
  }
  // Avancement sur toute la largeur, annoncé par une ligne de texte : sans elle, la barre passait pour une barre de défilement.
  const pourcentage = j.attendu > 0 && j.travaille !== null ? Math.min(100, Math.floor((travaille / j.attendu) * 100)) : null
  const reste = j.attendu - travaille
  const progression = pourcentage === null
    ? ''
    : `<div class="avancement">
      <div class="avancement-texte">
        <span>Avancement de la journée <b>${pourcentage} %</b></span>
        <span class="discret">${reste > 0 ? `encore ${formatDuree(reste)}` : `objectif dépassé de ${formatDuree(-reste)}`}</span>
      </div>
      <progress${pourcentage >= 100 ? ' class="fini"' : ''} max="100" value="${pourcentage}" aria-label="Avancement de la journée : ${pourcentage} %"></progress>
    </div>`

  return `<section class="carte aujourdhui" aria-label="Aujourd'hui">
    <div class="carte-tete">
      <h2>Aujourd’hui <span class="discret">${nomJourLong(j.cle)}</span></h2>
      ${pastille}
    </div>
    <div class="aujourdhui-grille">
      ${horaires}
      <div class="horaire fort">
        <span class="etiquette">Travaillé</span>
        <span class="valeur">${j.travaille === null ? '—' : formatDuree(travaille)}</span>
        ${j.attendu > 0 ? `<span class="sous">sur ${formatDuree(j.attendu)}</span>` : ''}
      </div>
      ${conseil}
    </div>
    ${progression}
  </section>`
}

// --- Synthèse ----------------------------------------------------------------------------------------------

function tuile(titre: string, valeur: number, ...details: string[]): string {
  return `<div class="tuile">
    <span class="etiquette">${titre}</span>
    <span class="valeur ${classeEcart(valeur)}">${formatDuree(valeur, true)}</span>
    ${details.map((d) => `<span class="sous">${d}</span>`).join('')}
  </div>`
}

/** « 16h13 faites sur 29h28 » puis l'explication de l'écart affiché. */
function detailsAvancement(a: Avancement): string[] {
  return [
    `${formatDuree(a.fait)} faites sur ${formatDuree(a.objectif)}`,
    a.jours ? `écart sur ${a.jours} jour${a.jours > 1 ? 's' : ''} terminé${a.jours > 1 ? 's' : ''}` : 'aucun jour terminé',
  ]
}

export function vueSynthese(c: Calculs, ctx: Contexte): string {
  const { reglages } = ctx.etat.donnees
  const depuis = c.premier ? `depuis le ${nomJourLong(c.premier)}` : 'aucun jour enregistré'
  const initial = reglages.soldeInitial ? `, report de ${formatDuree(reglages.soldeInitial, true)} compris` : ''
  return `<section class="synthese" aria-label="Soldes">
    ${tuile('Solde', c.solde, `${depuis}${initial}`)}
    ${tuile('Cette semaine', c.semaine.ecart, ...detailsAvancement(c.semaine))}
    ${tuile(`Mois de ${nomMois(ctx.mois).split(' ')[0]}`, c.bilanMois.ecart, ...detailsAvancement(c.bilanMois))}
  </section>`
}

// --- Journal du mois ---------------------------------------------------------------------------------------

function celluleHeure(j: Jour, champ: Champ): string {
  const m = j[champ]
  const vide = j.vides.includes(champ)
  const auto = j.auto[champ]
  const manuel = m?.manuel || vide
  const texte = m ? heureDe(m.t) : vide ? 'aucune' : '—'
  const titre = manuel
    ? `Corrigée à la main (détectée : ${auto === undefined ? 'rien' : heureDe(auto)})`
    : m ? 'Détectée automatiquement — cliquer pour corriger' : 'Cliquer pour saisir'
  return `<td class="heure" data-champ="${champ}">
    <button type="button" class="valeur${manuel ? ' manuel' : ''}${m ? '' : ' absente'}" data-action="editer" title="${titre}">${texte}</button>${
    manuel ? `<button type="button" class="retablir" data-action="retablir" title="Revenir à l’heure détectée" aria-label="Revenir à l’heure détectée">×</button>` : ''}
  </td>`
}

function ligneJour(j: Jour, ctx: Contexte, numero: number): string {
  const aujourdhui = j.cle === cleJourneeDe(ctx.maintenant)
  const classes = ['jour']
  if (j.attendu === 0) classes.push('repos')
  if (aujourdhui) classes.push('aujourdhui')
  if (j.statut === 'vide' && !aujourdhui && j.attendu > 0) classes.push('a-renseigner')
  if (j.statut === 'futur') classes.push('futur')
  const ouvert = ctx.ouverts.has(j.cle)

  let duree = '<span class="discret">—</span>'
  if (j.travaille !== null && (j.travaille > 0 || j.arrivee)) duree = formatDuree(j.travaille)
  else if (j.statut === 'vide' && !aujourdhui && j.attendu > 0) duree = '<span class="a-completer">à compléter</span>'
  if (j.alerte) duree += ` <span class="alerte" title="${echapper(j.alerte)}">!</span>`
  if (j.statut === 'en-cours') duree += ' <span class="discret">en cours</span>'

  let ecart = ''
  if (j.ecart !== null && j.statut !== 'en-cours' && (j.ecart !== 0 || j.travaille)) {
    ecart = j.compte
      ? `<span class="${classeEcart(j.ecart)}">${formatDuree(j.ecart, true)}</span>`
      : `<span class="hors-decompte" title="Avant le début du décompte : n’entre pas dans le solde">${formatDuree(j.ecart, true)}</span>`
  }
  const options = TYPES.map((t) => `<option value="${t}"${t === j.type ? ' selected' : ''}>${LIBELLES_TYPES[t]}</option>`).join('')

  const ligne = `<tr class="${classes.join(' ')}" data-cle="${j.cle}">
    <td class="date"><div class="date-contenu">
      <span class="numero">${numero}</span>
      <button type="button" class="deplier" data-action="details" aria-expanded="${ouvert}" title="Voir les événements du jour">${nomJourCourt(j.cle)}</button>
      ${j.ferie ? `<span class="ferie">${echapper(j.ferie)}</span>` : ''}
    </div></td>
    <td><select class="type${j.typeManuel ? ' manuel' : ''}" aria-label="Type du ${nomJourLong(j.cle)}">${options}</select></td>
    ${CHAMPS.map((champ) => celluleHeure(j, champ)).join('')}
    <td class="duree">${duree}</td>
    <td class="ecart">${ecart}</td>
    <td class="note"><input type="text" value="${echapper(j.note ?? '')}" maxlength="200" aria-label="Note du ${nomJourLong(j.cle)}"></td>
  </tr>`
  return ouvert ? ligne + ligneDetails(j, ctx) : ligne
}

function ligneDetails(j: Jour, ctx: Contexte): string {
  const debut = instant(j.cle, DEBUT_JOURNEE)
  const fin = instant(ajouterJours(j.cle, 1), DEBUT_JOURNEE)
  const evenements = ctx.etat.donnees.evenements.filter((e) => e.t >= debut && e.t < fin)
  const contenu = evenements.length
    ? `<ol class="evenements">${evenements.map((e) => `<li><b>${heureDe(e.t)}</b> ${LIBELLES_NATURES[e.nature]}</li>`).join('')}</ol>`
    : '<span class="discret">Aucun événement enregistré pour ce jour.</span>'
  return `<tr class="details" data-cle="${j.cle}"><td colspan="9">${contenu}</td></tr>`
}

function ligneSemaine(jours: readonly Jour[]): string {
  const b = bilan(jours)
  return `<tr class="semaine">
    <td colspan="6">Total semaine ${numeroSemaine(jours[0].cle)}</td>
    <td class="duree">${b.jours ? formatDuree(b.travaille) : ''}</td>
    <td class="ecart">${b.jours ? `<span class="${classeEcart(b.ecart)}">${formatDuree(b.ecart, true)}</span>` : ''}</td>
    <td></td>
  </tr>`
}

export function vueMois(c: Calculs, ctx: Contexte): string {
  const lignes: string[] = []
  let semaine: Jour[] = []
  c.joursMois.forEach((j, i) => {
    lignes.push(ligneJour(j, ctx, i + 1))
    semaine.push(j)
    if (jourSemaine(j.cle) === 7 || i === c.joursMois.length - 1) {
      lignes.push(ligneSemaine(semaine))
      semaine = []
    }
  })
  const b = c.bilanMois
  return `<section class="carte mois" aria-label="Journal du mois">
    <div class="carte-tete">
      <div class="navigation">
        <button type="button" class="bouton-icone" data-action="mois-precedent" title="Mois précédent" aria-label="Mois précédent">‹</button>
        <h2>${nomMois(ctx.mois)}</h2>
        <button type="button" class="bouton-icone" data-action="mois-suivant" title="Mois suivant" aria-label="Mois suivant">›</button>
        <button type="button" class="bouton-lien" data-action="mois-courant">Ce mois-ci</button>
      </div>
      <span class="discret">${formatDuree(b.fait)} faites sur ${formatDuree(b.objectif)} · écart <span class="${classeEcart(b.ecart)}">${formatDuree(b.ecart, true)}</span></span>
    </div>
    <div class="defilement">
      <table class="journal">
        <thead><tr>
          <th>Jour</th><th>Type</th><th>Arrivée</th><th>Pause</th><th>Reprise</th><th>Départ</th>
          <th>Travaillé</th><th>Écart</th><th>Note</th>
        </tr></thead>
        <tbody>${lignes.join('')}</tbody>
      </table>
    </div>
  </section>`
}

// --- Mises à jour ------------------------------------------------------------------------------------------

const dateFr = (cle: string) => cle.split('-').reverse().join('/')

/** Bandeau du Journal quand une nouvelle version attend d'être installée. */
export function bandeauMaj(etat: Etat): string {
  const v = etat.maj.disponible
  if (etat.maj.statut !== 'disponible' || !v) return ''
  return `<div class="annonce" role="status">
    <span>Pointage <b>${echapper(v.version)}</b> est disponible.</span>
    <button type="button" class="bouton principal" data-vue="reglages">Voir la mise à jour</button>
  </div>`
}

export function vueMaj(etat: Etat): string {
  const { maj } = etat
  const v = maj.disponible
  const occupe = maj.statut === 'recherche' || maj.statut === 'telechargement' || maj.statut === 'installation'
  let statut: string
  switch (maj.statut) {
    case 'recherche':
      statut = '<p class="maj-statut">Recherche en cours…</p>'
      break
    case 'a-jour':
      statut = `<p class="maj-statut ok">Pointage est à jour${maj.verifieLe ? ` (vérifié à ${heureDe(maj.verifieLe)})` : ''}.</p>`
      break
    case 'telechargement':
      statut = `<p class="maj-statut">Téléchargement de la version ${echapper(v?.version ?? '')} : <b>${maj.progression ?? 0} %</b></p>
        <progress max="100" value="${maj.progression ?? 0}" aria-label="Téléchargement de la mise à jour"></progress>`
      break
    case 'installation':
      statut = '<p class="maj-statut">Installation en cours : Pointage se ferme puis redémarre tout seul.</p>'
      break
    case 'erreur':
      statut = `<p class="maj-statut erreur">${echapper(maj.erreur ?? 'Recherche impossible.')}</p>`
      break
    default:
      statut = '<p class="maj-statut discret">Aucune recherche pour le moment.</p>'
  }
  const nouveautes = v && maj.statut === 'disponible'
    ? `<div class="maj-disponible">
        <p><b>Version ${echapper(v.version)} disponible</b>${v.date ? ` <span class="discret">publiée le ${dateFr(v.date)}</span>` : ''}</p>
        ${v.notes ? `<ul>${lignesNotes(v.notes).slice(0, 12).map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>` : ''}
      </div>`
    : ''
  const desactive = occupe ? ' disabled' : ''
  return `<section class="carte reglages" aria-label="Mises à jour">
    <div class="carte-tete"><h2>Mises à jour</h2><span class="discret">Version installée : ${echapper(etat.version)}</span></div>
    ${statut}
    ${nouveautes}
    <div class="actions">
      ${v && maj.statut === 'disponible' ? `<button type="button" class="bouton principal" data-action="maj-installer">Installer la version ${echapper(v.version)}</button>` : ''}
      <button type="button" class="bouton" data-action="maj-rechercher"${desactive}>Rechercher une mise à jour</button>
      <button type="button" class="bouton" data-action="maj-fichier"${desactive}>Installer depuis un fichier…</button>
    </div>
    <label class="case"><input type="checkbox" data-reglage="majAuto"${etat.donnees.reglages.majAuto ? ' checked' : ''}> Rechercher automatiquement au démarrage, puis toutes les 6 heures</label>
    <p class="aide">Les versions sont publiées sur GitHub (${echapper(DEPOT)}). L’installation garde vos heures et réglages, puis Pointage redémarre tout seul.</p>
  </section>`
}

// --- Réglages ----------------------------------------------------------------------------------------------

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function vueReglages(etat: Etat): string {
  const r = etat.donnees.reglages
  const jours = JOURS_COURTS.map((nom, i) => `<label class="case-jour">
      <input type="checkbox" data-jour="${i + 1}"${r.joursTravailles.includes(i + 1) ? ' checked' : ''}> ${nom}
    </label>`).join('')
  const lecture = etat.donnees.derniereLecture
  return `<section class="carte reglages" aria-label="Réglages">
    <div class="carte-tete"><h2>Réglages</h2></div>
    <div class="formulaire">
      <label for="r-objectif">Temps de travail par jour</label>
      <div><input id="r-objectif" data-reglage="objectif" value="${formatDuree(r.objectif)}" size="6"></div>
      <p class="aide">Durée attendue chaque jour travaillé (la moitié pour une demi-journée).</p>

      <span class="etiquette-champ">Jours travaillés</span>
      <div class="jours" data-reglage="joursTravailles">${jours}</div>
      <p class="aide">Les jours fériés sont reconnus automatiquement ; le type de chaque jour se change dans le journal.</p>

      <label for="r-pause-debut">Plage de la pause de midi</label>
      <div class="ligne-champs">
        <input id="r-pause-debut" type="time" data-reglage="pauseDebut" value="${r.pauseDebut}">
        <span>à</span>
        <input id="r-pause-fin" type="time" data-reglage="pauseFin" value="${r.pauseFin}" aria-label="Fin de la plage de pause">
      </div>
      <p class="aide">La plus longue absence (veille, arrêt, verrouillage) qui touche cette plage devient la pause.</p>

      <label for="r-pause-min">Pause minimale</label>
      <div class="ligne-champs"><input id="r-pause-min" type="number" min="1" max="240" data-reglage="pauseMin" value="${r.pauseMin}"> <span>minutes</span></div>
      <p class="aide">Une absence plus courte (redémarrage, café) n’est pas prise pour la pause.</p>

      <label for="r-pause-prevue">Pause prévue</label>
      <div class="ligne-champs"><input id="r-pause-prevue" type="number" min="0" max="240" data-reglage="pausePrevue" value="${r.pausePrevue}"> <span>minutes</span></div>
      <p class="aide">Ajoutée au départ conseillé tant que la pause n’a pas été prise.</p>

      <label for="r-solde">Solde de départ</label>
      <div><input id="r-solde" data-reglage="soldeInitial" value="${formatDuree(r.soldeInitial, true)}" size="7"></div>
      <p class="aide">Heures en plus (+) ou en moins (-) à reporter d’avant l’application, par exemple « +3h15 ».</p>

      <label for="r-debut">Début du décompte</label>
      <div class="ligne-champs">
        <input id="r-debut" type="date" data-reglage="dateDebut" value="${r.dateDebut}">
        ${r.dateDebut ? '<button type="button" class="bouton-lien" data-action="debut-tout">Tout compter</button>' : ''}
      </div>
      <p class="aide">${r.dateDebut ? 'Les jours précédents restent visibles mais ne comptent pas dans le solde.' : 'Vide : tous les jours connus comptent, y compris l’historique repris du journal Windows.'}</p>

      <span class="etiquette-champ">Thème</span>
      <div class="segments" role="radiogroup" aria-label="Thème">${THEMES.map((t) => `<label class="segment">
          <input type="radio" name="theme" data-reglage="theme" value="${t}"${r.theme === t ? ' checked' : ''}> ${capitaliser(LIBELLES_THEMES[t])}
        </label>`).join('')}</div>
      <p class="aide">Le thème sombre peut être forcé même si Windows est en clair.</p>

      <span class="etiquette-champ">Démarrage</span>
      <label class="case"><input type="checkbox" data-action="autostart"${etat.autostart ? ' checked' : ''}> Lancer Pointage à l’ouverture de session Windows</label>
      <p class="aide">${etat.installee ? 'Pointage démarre alors discrètement dans la zone de notification.' : 'Version de développement : préférez l’activer depuis la version installée.'}</p>

      <span class="etiquette-champ">Notification</span>
      <div class="ligne-champs">
        <label class="case"><input type="checkbox" data-reglage="notifier"${r.notifier ? ' checked' : ''}> Me prévenir quand le temps du jour est atteint</label>
        <button type="button" class="bouton" data-action="tester-notification">Essayer</button>
      </div>
      <p class="aide">Une notification Windows apparaît en bas à droite de l’écran dès que le temps du jour est fait, si Pointage tourne (zone de notification).</p>
    </div>
  </section>

  ${vueMaj(etat)}

  <section class="carte reglages" aria-label="Données">
    <div class="carte-tete"><h2>Données</h2></div>
    <p>Toutes les données restent sur ce PC, dans <code>${echapper(etat.cheminDonnees)}</code>.
      ${etat.donnees.evenements.length} événements enregistrés${lecture ? `, journal Windows lu le ${nomJourLong(cleJourneeDe(lecture))} à ${heureDe(lecture)}` : ''}.</p>
    <div class="actions">
      <button type="button" class="bouton" data-action="exporter-csv">Exporter en CSV (Excel)</button>
      <button type="button" class="bouton" data-action="sauvegarder">Sauvegarder…</button>
      <button type="button" class="bouton" data-action="restaurer">Restaurer…</button>
      <button type="button" class="bouton" data-action="ouvrir-dossier">Ouvrir le dossier</button>
    </div>
  </section>

  <section class="carte reglages" aria-label="Fonctionnement">
    <div class="carte-tete"><h2>Comment les heures sont trouvées</h2></div>
    <ul class="explications">
      <li><b>Arrivée</b> : premier démarrage, ouverture de session ou sortie de veille de la journée (à partir de ${ecrireHeure(DEBUT_JOURNEE)}).</li>
      <li><b>Pause et reprise</b> : la plus longue absence entre ${r.pauseDebut} et ${r.pauseFin}, d’au moins ${r.pauseMin} minutes.</li>
      <li><b>Départ</b> : dernier arrêt, mise en veille ou verrouillage de la journée.</li>
      <li>Ces moments sont lus dans le journal de Windows : rien n’est perdu si Pointage était fermé. Les verrouillages (Windows + L) ne sont vus que lorsque Pointage tourne.</li>
      <li>Toute heure se corrige d’un clic dans le journal ; la croix la ramène à l’heure détectée.</li>
    </ul>
    <p class="discret">Pointage ${echapper(etat.version)}</p>
  </section>`
}
