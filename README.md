# Pointage

Suivi des heures de travail sans rien saisir : Pointage lit dans le journal de Windows quand le PC démarre, se met en veille, se réveille et s'arrête, et en déduit chaque jour l'arrivée, la pause de midi, la reprise et le départ. Il calcule le temps travaillé, l'écart par rapport aux 7h22 attendues et le solde cumulé d'heures en plus ou en moins.

## Installation sur le PC professionnel

1. Copier `Pointage-Installation-0.1.0.exe` sur le PC (clé USB, OneDrive…), puis le lancer : l'installation se fait pour l'utilisateur, sans droits administrateur, et ouvre Pointage.
2. Si Windows affiche « Windows a protégé votre ordinateur » (l'application n'est pas signée) : *Informations complémentaires* → *Exécuter quand même*.
3. C'est tout : Pointage se lance désormais à chaque ouverture de session, discrètement dans la zone de notification (icône horloge, à côté de l'heure). Un clic l'ouvre ; fermer la fenêtre le laisse tourner.

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
- **Réglages** : durée quotidienne, jours travaillés, plage et durée de pause, solde reporté d'avant l'application, début du décompte, thème (comme Windows, clair ou sombre), lancement automatique, notification.
- **Données** : stockées sur le PC (`%APPDATA%\Pointage\pointage.json`, avec une copie de secours). Export CSV pour Excel, sauvegarde et restauration.

## Développement

```
npm install
npx install-electron       # binaire Electron
npm start                  # lancer depuis les sources
npx tsc --noEmit -p .      # typage
npx vitest run             # tests
npm run dist               # installateur dans release/
```
