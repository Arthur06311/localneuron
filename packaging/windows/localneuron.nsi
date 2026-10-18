; Instalador NSIS do LocalNeuron. Não assina o executável.
; Assinatura Authenticode entra mais tarde, a cargo do Arthur. Não chamar signtool aqui.
!ifndef VERSION
  !error "Defina VERSION antes de incluir este script."
!endif
!ifndef VERSION4
  !error "Defina VERSION4 no formato X.Y.Z.0."
!endif
!ifndef SOURCE
  !error "Defina SOURCE com a pasta do Electron Packager."
!endif
!ifndef OUTFILE
  !error "Defina OUTFILE com o caminho do instalador."
!endif
!ifndef ESTIMATED_SIZE
  !error "Defina ESTIMATED_SIZE em KiB."
!endif

Unicode True
!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "LocalNeuron ${VERSION}"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES64\LocalNeuron"
InstallDirRegKey HKLM "Software\LocalNeuron" "InstallDir"
RequestExecutionLevel admin
SetCompressor lzma
ManifestDPIAware true

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\LocalNeuron.exe"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

VIProductVersion "${VERSION4}"
VIFileVersion "${VERSION4}"
VIAddVersionKey "ProductName" "LocalNeuron"
VIAddVersionKey "FileDescription" "LocalNeuron"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "LocalNeuron"
VIAddVersionKey "CompanyName" "LocalNeuron"

Section "LocalNeuron"
  SetOutPath "$INSTDIR"
  File /r "${SOURCE}/*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\LocalNeuron"
  CreateShortcut "$SMPROGRAMS\LocalNeuron\LocalNeuron.lnk" "$INSTDIR\LocalNeuron.exe"
  CreateShortcut "$SMPROGRAMS\LocalNeuron\Desinstalar LocalNeuron.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\LocalNeuron" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalNeuron" "DisplayName" "LocalNeuron"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalNeuron" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalNeuron" "Publisher" "LocalNeuron"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalNeuron" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalNeuron" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalNeuron" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalNeuron" "NoRepair" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalNeuron" "EstimatedSize" ${ESTIMATED_SIZE}
SectionEnd

Section "Uninstall"
  ${If} ${FileExists} "$INSTDIR\LocalNeuron.exe"
    Delete "$SMPROGRAMS\LocalNeuron\LocalNeuron.lnk"
    Delete "$SMPROGRAMS\LocalNeuron\Desinstalar LocalNeuron.lnk"
    RMDir "$SMPROGRAMS\LocalNeuron"
    RMDir /r "$INSTDIR"
  ${Else}
    MessageBox MB_ICONSTOP "Não encontrei LocalNeuron.exe na pasta de instalação. Nada foi apagado."
  ${EndIf}
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LocalNeuron"
  DeleteRegKey HKLM "Software\LocalNeuron"
SectionEnd
