# Pointage : règles propres

Application Windows (Electron) de suivi des heures de travail : arrivée, pause de midi, reprise et départ sont déduits du journal Système de Windows (démarrage, ouverture de session, veille, réveil, arrêt) et des verrouillages de session ; objectif quotidien 7h22, solde d'heures en plus ou en moins. Même famille que [comptes-partages](../comptes-partages) et [noels](../noels). Règles communes : `../CLAUDE.md`.

- **Usage** : sur le PC professionnel de l'utilisateur, données locales (`%APPDATA%\Pointage\pointage.json`), aucun serveur ni compte.
- **Thème** : variables CSS de `style.css`, réglage Thème (comme Windows / clair / sombre) ; captures via `POINTAGE_CAPTURE` et `POINTAGE_THEME` (voir Pièges).
- **Tests** : logique dans `src/lib`, rendu de `src/renderer/vue.ts` sous jsdom, tout dans `tests/unit`. Fuseau des tests fixé à Europe/Paris (`vitest.config.mjs`).
- **Publication** (c'est elle qui alimente « Rechercher une mise à jour ») : après le push du tag, `npm run dist` puis `gh release create vX.Y.Z release/Pointage-Installation-X.Y.Z.exe release/Pointage-Portable-X.Y.Z.zip release/Pointage-Portable-LISEZMOI.txt --repo DodgeMyAxes/pointage --title "Pointage X.Y.Z" --notes "<nouveautés en français, une puce par changement>"`. Dépôt **public** DodgeMyAxes/pointage (choix de l'utilisateur, le code seulement : aucune donnée personnelle dans le dépôt).
- **Interface** : durées au format `7h22`, écarts signés `+0h15` / `-1h03`.

## Architecture

- `src/lib/` : logique pure, testée. `journal.ts` (requête wevtutil et lecture du XML), `calcul.ts` (transitions présent/absent → journées, solde, départ conseillé, avancement d'une période), `donnees.ts` (modèle, validation), `import.ts` (texte « JJ/MM/AAAA hh:mm… » et CSV à en-tête), `exports.ts` (CSV, texte), `maj.ts` (versions GitHub), `temps.ts`, `feries.ts`, `synchro.ts`, `resume.ts`.
- `src/main/` : processus principal (zone de notification, IPC, lecture du journal par `wevtutil.exe`, stockage JSON atomique avec copie `.bak`, `mises-a-jour.ts` : recherche par `net.fetch` (proxy de Windows), téléchargement vérifié par taille et SHA-256, installation silencieuse `/S --force-run`).
- `src/renderer/` : fenêtre en TypeScript sans framework ; `vue.ts` rend du HTML, `app.ts` branche les événements.
- Une journée va de 4 h à 4 h. Temps travaillé = (pause − arrivée) + (départ − reprise). Heure corrigée à la main : prioritaire ; `""` = forcée à vide.

## Commandes

- `npm start` : assemble `dist/` et lance l'application.
- `npm run dist` : installateur `release/Pointage-Installation-X.Y.Z.exe` (NSIS) et version portable `release/Pointage-Portable-X.Y.Z.zip` (`scripts/portable.mjs` : dossier `Pointage` + `portable.txt` + `LISEZMOI.txt` tiré de `build/portable/`). Portable = `portable.txt` à côté de l'exe sans désinstalleur : données et cache dans `donnees`, pas de démarrage auto d'office, mise à jour par lien vers la release.
- `npm run icone` : régénère `build/icone.ico` et `build/icone.png`.

## Pièges

- Depuis VS Code, `ELECTRON_RUN_AS_NODE=1` est défini : Electron tourne alors comme Node (`app` indéfini). Le retirer avant de lancer (`Remove-Item Env:ELECTRON_RUN_AS_NODE`).
- Développement : `POINTAGE_DOSSIER` (dossier de données séparé, à utiliser pour ne pas toucher aux vraies données), `POINTAGE_CAPTURE` (capture PNG de la fenêtre puis sortie), `POINTAGE_CAPTURE_JS` (script exécuté avant la capture), `POINTAGE_THEME=light|dark`.
- Un premier lancement de la version installée inscrit Pointage au démarrage de Windows : ne pas lancer `release/win-unpacked/Pointage.exe` sur un dossier de données vide sur ce PC.
- Kernel-Power 107 est horodaté avec l'horloge d'avant la veille : ne pas l'utiliser.
- npm exige `allowScripts` pour les scripts d'installation (esbuild autorisé) ; le binaire Electron se télécharge avec `npx install-electron`.
