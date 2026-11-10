; Ajouts à l'installateur NSIS d'electron-builder (inclus automatiquement depuis build/).
; Le raccourci du menu Démarrer est créé par Pointage lui-même, dans le menu de l'utilisateur : la désinstallation le
; retire, sauf pendant une mise à jour. Pour une installation pour tous, $SMPROGRAMS vise le menu commun : on passe
; un instant au menu de l'utilisateur.
; Installation pour tous : l'installateur désinstalle d'abord l'ancienne installation par utilisateur (AppData). Sur un
; PC d'entreprise qui y interdit les programmes, ce désinstalleur peut échouer : on continue quand même, Pointage
; effacera cette ancienne copie à son lancement.
!macro customUnInstallCheckCurrentUser
  ClearErrors
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    SetShellVarContext current
    Delete "$SMPROGRAMS\Pointage.lnk"
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endIf}
  ${endIf}
!macroend
