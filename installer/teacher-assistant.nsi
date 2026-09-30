; Teacher Assistant Windows Installer Script (NSIS)
; Per-user install: no Administrator rights required, works on school-managed laptops

!include "MUI2.nsh"
!include "FileFunc.nsh"

; General Settings
Name "Teacher Assistant"
OutFile "..\release\TeacherAssistant-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\TeacherAssistant"
InstallDirRegKey HKCU "Software\TeacherAssistant" "InstallDir"
RequestExecutionLevel user

; Interface Configuration
!define MUI_ICON "..\public\icon.ico"
!define MUI_UNICON "..\public\icon.ico"
!define MUI_ABORTWARNING

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

; Finish Page: Option to launch application immediately
!define MUI_FINISHPAGE_RUN "$INSTDIR\start-app.bat"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Teacher Assistant now"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

; Version Info
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "Teacher Assistant"
VIAddVersionKey "ProductVersion" "1.0.0"
VIAddVersionKey "FileDescription" "Teacher Assistant Desktop Installer"
VIAddVersionKey "FileVersion" "1.0.0"
VIAddVersionKey "LegalCopyright" "Educational & Classroom Management"

Section "Install"
  SetOutPath "$INSTDIR"

  ; Release source directory (matches release folder output from build-release)
  File /r "..\release\TeacherAssistant-v1.0.0\*.*"

  ; Store installation folder in registry
  WriteRegStr HKCU "Software\TeacherAssistant" "InstallDir" "$INSTDIR"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Desktop Shortcut
  CreateShortCut "$DESKTOP\Teacher Assistant.lnk" "$INSTDIR\start-app.bat" "" "$INSTDIR\public\icon.ico" 0

  ; Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\Teacher Assistant"
  CreateShortCut "$SMPROGRAMS\Teacher Assistant\Teacher Assistant.lnk" "$INSTDIR\start-app.bat" "" "$INSTDIR\public\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\Teacher Assistant\Teacher Assistant (Network Mode).lnk" "$INSTDIR\start-internal-site.bat" "" "$INSTDIR\public\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\Teacher Assistant\Uninstall Teacher Assistant.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0

  ; Register in Windows "Apps & Features" / "Add or Remove Programs"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant" "DisplayName" "Teacher Assistant"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant" "DisplayIcon" "$INSTDIR\public\icon.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant" "Publisher" "Teacher Assistant"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant" "NoRepair" 1

SectionEnd

Section "Uninstall"
  ; Remove shortcuts
  Delete "$DESKTOP\Teacher Assistant.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Teacher Assistant.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Teacher Assistant (Network Mode).lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Uninstall Teacher Assistant.lnk"
  RMDir "$SMPROGRAMS\Teacher Assistant"

  ; Remove registry keys
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant"
  DeleteRegKey HKCU "Software\TeacherAssistant"

  ; Remove files
  RMDir /r "$INSTDIR"
SectionEnd
