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

; Icône du bureau, comme les premières versions : à la première installation seulement (une mise à jour ne la recrée
; pas si l'utilisateur l'a supprimée). Créée ici plutôt que par createDesktopShortcut, dont l'échec arrêterait
; l'installation : un refus (stratégie de l'entreprise) est ignoré. Installation pour tous : bureau commun.
!macro customInstall
  ${ifNot} ${isUpdated}
    ClearErrors
    CreateShortCut "$DESKTOP\Pointage.lnk" "$INSTDIR\Pointage.exe" "" "$INSTDIR\Pointage.exe" 0
    ClearErrors
  ${endIf}
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    Delete "$DESKTOP\Pointage.lnk"
    SetShellVarContext current
    Delete "$SMPROGRAMS\Pointage.lnk"
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endIf}
  ${endIf}
!macroend
