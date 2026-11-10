; Ajouts à l'installateur NSIS d'electron-builder (inclus automatiquement depuis build/).
; Le raccourci du menu Démarrer est créé par Pointage lui-même : la désinstallation le retire, sauf pendant une mise à jour.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    Delete "$SMPROGRAMS\Pointage.lnk"
  ${endIf}
!macroend
