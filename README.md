# Pointage

Suivi des heures de travail sans rien saisir : Pointage lit dans le journal de Windows quand le PC démarre, se met en veille, se réveille et s'arrête, et en déduit chaque jour l'arrivée, la pause de midi, la reprise et le départ. Il calcule le temps travaillé, l'écart par rapport aux 7h22 attendues et le solde cumulé d'heures en plus ou en moins.

## Installation sur le PC professionnel

1. Télécharger `Pointage-Installation-X.Y.Z.exe` (page *Releases* du dépôt, section *Assets*) ou le copier sur le PC (clé USB, OneDrive…), puis le lancer.
2. Si Windows affiche « Windows a protégé votre ordinateur » (l'application n'est pas signée) : *Informations complémentaires* → *Exécuter quand même*.
3. Choisir pour qui installer :
   - **Pour tous les utilisateurs** (droits administrateur demandés) : installation dans `C:\Program Files\Pointage`. À choisir sur un PC d'entreprise qui interdit les programmes dans le dossier de l'utilisateur (message « Windows ne parvient pas à accéder au périphérique, au chemin d'accès ou au fichier spécifié »). Une ancienne installation « pour moi seulement » est alors effacée, et le lancement automatique recalé ; les heures et réglages sont conservés.
   - **Pour moi seulement** : installation dans `AppData\Local\Programs\pointage`, sans droits administrateur.
4. C'est tout : Pointage se lance désormais à chaque ouverture de session, discrètement dans la zone de notification (icône horloge, à côté de l'heure). Un clic l'ouvre ; fermer la fenêtre le laisse tourner. Le raccourci du menu Démarrer est créé par Pointage lui-même à son premier lancement (l'installateur n'en crée pas : cela échouait sur certains PC d'entreprise).

Au premier lancement, l'historique encore présent dans le journal Windows (souvent plusieurs semaines) est repris et affiché, mais le solde ne compte qu'à partir du lundi de la semaine en cours. *Réglages → Tout compter* inclut aussi l'historique.

## Comment les heures sont trouvées

- **Arrivée** : premier démarrage, ouverture de session ou sortie de veille de la journée.
- **Pause et reprise** : la plus longue absence (veille, arrêt ou verrouillage Windows + L) qui touche la plage 11:00–15:00 et dure au moins 15 minutes.
- **Départ** : dernier arrêt, mise en veille ou verrouillage de la journée.
- Une journée va de 4 h à 4 h : un départ après minuit compte pour la veille. Un redémarrage de nuit pour les mises à jour est ignoré.

Rien n'est perdu si Pointage était fermé : tout est relu dans le journal Windows (au lancement, au réveil, à l'ouverture de la fenêtre). Seuls les verrouillages ne sont vus que lorsque Pointage tourne.

## Au quotidien

- **Aujourd'hui** : heures du jour, temps fait, heure de départ conseillée pour faire 7h22 (et pour ramener le solde à zéro). Une notification prévient quand le temps du jour est atteint.
- **Journal du mois** : cliquer une heure pour la corriger (en violet = corrigée à la main ; la croix ramène l'heure détectée). Le type de jour se change dans la liste : Travail, Récupération, Demi-journée, Congé, Férié, Absence, Repos. Les jours fériés français sont reconnus. Cliquer la date affiche les événements Windows du jour.
- **Réglages** : durée quotidienne, jours travaillés, plage et durée de pause, solde reporté d'avant l'application, début du décompte, thème (comme Windows, clair ou sombre), lancement automatique, notification (avec un bouton d'essai).
- **Données** : stockées sur le PC (`%APPDATA%\Pointage\pointage.json`, avec une copie de secours).
  - *Exporter…* : tableau CSV pour Excel, texte (une ligne par jour) ou sauvegarde complète JSON.
  - *Importer…* : coller des lignes ou ouvrir un fichier, avec aperçu avant d'importer tout d'un coup. Une ligne par jour : `02/11/2026 9:30 12:00 13:55 17:10` (ou `03/11/2026 8:45 17:30` sans pause, ou `04/11/2026 congé Pont`). Un CSV avec une ligne d'en-tête (Date, Arrivée, Pause, Reprise, Départ, Type, Note) convient aussi. Un fichier `.json` restaure une sauvegarde complète.

## Mises à jour

*Réglages → Mises à jour* : *Rechercher une mise à jour* interroge GitHub (dépôt public `DodgeMyAxes/pointage`, le code seulement). Une nouvelle version s'installe en un clic : téléchargement vérifié, installation silencieuse, redémarrage, données conservées. La recherche se fait aussi toute seule une fois par semaine, au premier démarrage ou réveil du lundi (ou du premier jour où le PC sert dans la semaine), avec une notification quand une version sort. *Installer depuis un fichier…* installe un `Pointage-Installation-X.Y.Z.exe` reçu autrement (mail, clé USB) si github.com est bloqué.

## Développement

```
npm install
npx install-electron       # binaire Electron
npm start                  # lancer depuis les sources
npx tsc --noEmit -p .      # typage
npx vitest run             # tests
npm run dist               # installateur dans release/
```
