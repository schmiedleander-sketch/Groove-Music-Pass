
!addincludedir "/home/jules/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n/Include"

!define PRODUCT_NAME "Groove Music Pass"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "Microsoft Corporation"
!define PRODUCT_WEB_SITE "https://www.microsoft.com"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\GrooveMusicPass"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Groove Music Pass"

SetCompressor /SOLID lzma
Name "Groove Music Pass 1.0.0"
OutFile "/app/dist/GrooveMusicPass_Setup_1.0.0.exe"
InstallDir "$PROGRAMFILES64\Groove Music Pass"
Icon "/app/assets/icon.ico"
UninstallIcon "/app/assets/icon.ico"
ShowInstDetails show
ShowUnInstDetails show

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  File /r "/app/dist/win-unpacked\*"

  CreateDirectory "$SMPROGRAMS\Groove Music Pass"
  CreateShortcut "$SMPROGRAMS\Groove Music Pass\Groove Music Pass.lnk" "$INSTDIR\Groove Music Pass.exe" "" "/app/assets/icon.ico"
  CreateShortcut "$DESKTOP\Groove Music Pass.lnk" "$INSTDIR\Groove Music Pass.exe" "" "/app/assets/icon.ico"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\uninst.exe"
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\Groove Music Pass.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "Groove Music Pass"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\Groove Music Pass.exe"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "1.0.0"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "Microsoft Corporation"
SectionEnd

Function un.onUninstSuccess
  HideWindow
  MessageBox MB_OK|MB_ICONINFORMATION "Groove Music Pass was successfully removed from your computer."
FunctionEnd

Section Uninstall
  Delete "$DESKTOP\Groove Music Pass.lnk"
  Delete "$SMPROGRAMS\Groove Music Pass\Groove Music Pass.lnk"
  RMDir "$SMPROGRAMS\Groove Music Pass"

  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
SectionEnd
