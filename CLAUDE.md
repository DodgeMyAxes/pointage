# Pointage : règles de travail

Application Windows (Electron) de suivi des heures de travail : arrivée, pause de midi, reprise et départ sont déduits du journal Système de Windows (démarrage, ouverture de session, veille, réveil, arrêt) et des verrouillages de session ; objectif quotidien 7h22, solde d'heures en plus ou en moins. Même famille que [comptes-partages](../comptes-partages) et [noels](../noels) : mêmes conventions.

- **Première action de chaque session** : lire `session-checkpoint.yaml` (racine, hors git) et suivre son `INSTRUCTION`. « fin session » ou « fin de session » : le réécrire à jour, sans demander.
- **Langue** : interface, messages, commentaires et commits en français ; vouvoiement de l'utilisateur.
- **Usage** : un seul utilisateur, sur son PC professionnel, données locales (`%APPDATA%\Pointage\pointage.json`), aucun serveur ni compte.
- **Mode sombre obligatoire** : tout écran est soigné en sombre et en clair (variables CSS de `style.css`, réglage Thème : comme Windows / clair / sombre) ; vérifier les deux par capture avant de rendre la main.
- **Tests systématiques** : chaque fonctionnalité ou correction arrive avec ses tests dans `tests/unit` (logique dans `src/lib`, rendu de `src/renderer/vue.ts` sous jsdom). Lancer `npx tsc --noEmit -p .` et `npx vitest run` avant de rendre la main. Le fuseau des tests est fixé à Europe/Paris (`vitest.config.mjs`).
- **Commits** : seulement sur « commit push ». Conventional Commits en français (`type(portée): description`, corps en liste), un thème par commit, chaque commit vérifié seul (tsc + vitest) dans un worktree temporaire. Puis montée de version semver (feat → mineure, sinon correctif) : `npm version <niveau> --no-git-tag-version`, commit `chore(version): X.Y.Z`, tag annoté `vX.Y.Z`, `git push` + push du tag, puis `git push origin dev:main` (jamais forcé). Annoncer la durée restante pendant les vérifications. **Publication** (c'est elle qui alimente « Rechercher une mise à jour ») : après le push du tag, `npm run dist` puis `gh release create vX.Y.Z release/Pointage-Installation-X.Y.Z.exe --repo Arceus33/pointage --title "Pointage X.Y.Z" --notes "<nouveautés en français, une puce par changement>"`. Dépôt **public** Arceus33/pointage (choix de l'utilisateur, le code seulement : aucune donnée personnelle dans le dépôt).
- **Interface** (comme les projets frères) : bandes grises au survol des lignes, petits numéros de ligne, croix de rétablissement discrètes, messages (toasts) qui nomment l'élément concerné et jamais sur la barre de menu, chaque bascule donne un court message, durées au format `7h22`, écarts signés `+0h15` / `-1h03`.

## Architecture

- `src/lib/` : logique pure, testée. `journal.ts` (requête wevtutil et lecture du XML), `calcul.ts` (transitions présent/absent → journées, solde, départ conseillé, avancement d'une période), `donnees.ts` (modèle, validation), `import.ts` (texte « JJ/MM/AAAA hh:mm… » et CSV à en-tête), `exports.ts` (CSV, texte), `maj.ts` (versions GitHub), `temps.ts`, `feries.ts`, `synchro.ts`, `resume.ts`.
- `src/main/` : processus principal (zone de notification, IPC, lecture du journal par `wevtutil.exe`, stockage JSON atomique avec copie `.bak`, `mises-a-jour.ts` : recherche par `net.fetch` (proxy de Windows), téléchargement vérifié par taille et SHA-256, installation silencieuse `/S --force-run`).
- `src/renderer/` : fenêtre en TypeScript sans framework ; `vue.ts` rend du HTML, `app.ts` branche les événements.
- Une journée va de 4 h à 4 h. Temps travaillé = (pause − arrivée) + (départ − reprise). Heure corrigée à la main : prioritaire ; `""` = forcée à vide.

## Commandes

- `npm start` : assemble `dist/` et lance l'application.
- `npm run dist` : installateur `release/Pointage-Installation-X.Y.Z.exe` (NSIS, par utilisateur, sans droits admin).
- `npm run icone` : régénère `build/icone.ico` et `build/icone.png`.

## Pièges

- Depuis VS Code, `ELECTRON_RUN_AS_NODE=1` est défini : Electron tourne alors comme Node (`app` indéfini). Le retirer avant de lancer (`Remove-Item Env:ELECTRON_RUN_AS_NODE`).
- Développement : `POINTAGE_DOSSIER` (dossier de données séparé, à utiliser pour ne pas toucher aux vraies données), `POINTAGE_CAPTURE` (capture PNG de la fenêtre puis sortie), `POINTAGE_CAPTURE_JS` (script exécuté avant la capture), `POINTAGE_THEME=light|dark`.
- Un premier lancement de la version installée inscrit Pointage au démarrage de Windows : ne pas lancer `release/win-unpacked/Pointage.exe` sur un dossier de données vide sur ce PC.
- Captures : PowerShell 5.1 lit les fichiers en ANSI, passer `-Encoding UTF8` à `Get-Content` pour un script contenant des accents.
- Kernel-Power 107 est horodaté avec l'horloge d'avant la veille : ne pas l'utiliser.
- npm exige `allowScripts` pour les scripts d'installation (esbuild autorisé) ; le binaire Electron se télécharge avec `npx install-electron`.
