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

; Finish Page: Option to launch application immediately and optional autostart
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Teacher Assistant now"

!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Start Teacher Assistant automatically when Windows starts"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION "EnableAutoStart"
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

  ; Desktop Shortcuts
  CreateShortCut "$DESKTOP\Teacher Assistant.lnk" "$INSTDIR\start-app.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWMINIMIZED "" "Launch Teacher Assistant"
  CreateShortCut "$DESKTOP\Stop Teacher Assistant.lnk" "$INSTDIR\stop-app.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWNORMAL "" "Stop Teacher Assistant"

  ; Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\Teacher Assistant"
  CreateShortCut "$SMPROGRAMS\Teacher Assistant\Teacher Assistant.lnk" "$INSTDIR\start-app.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWMINIMIZED "" "Launch Teacher Assistant"
  CreateShortCut "$SMPROGRAMS\Teacher Assistant\Teacher Assistant (Network Mode).lnk" "$INSTDIR\start-internal-site.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWNORMAL "" "Launch Teacher Assistant in Network Mode"
  CreateShortCut "$SMPROGRAMS\Teacher Assistant\Stop Teacher Assistant.lnk" "$INSTDIR\stop-app.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWNORMAL "" "Stop Teacher Assistant"
  CreateShortCut "$SMPROGRAMS\Teacher Assistant\Enable Autostart on Boot.lnk" "$INSTDIR\enable-autostart.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWNORMAL "" "Enable Automatic Startup on Login"
  CreateShortCut "$SMPROGRAMS\Teacher Assistant\Disable Autostart on Boot.lnk" "$INSTDIR\disable-autostart.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWNORMAL "" "Disable Automatic Startup"
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
  ; Remove startup shortcut if enabled
  Delete "$SMSTARTUP\Teacher Assistant.lnk"

  ; Remove shortcuts
  Delete "$DESKTOP\Teacher Assistant.lnk"
  Delete "$DESKTOP\Stop Teacher Assistant.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Teacher Assistant.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Teacher Assistant (Network Mode).lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Stop Teacher Assistant.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Enable Autostart on Boot.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Disable Autostart on Boot.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Uninstall Teacher Assistant.lnk"
  RMDir "$SMPROGRAMS\Teacher Assistant"

  ; Remove registry keys
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant"
  DeleteRegKey HKCU "Software\TeacherAssistant"

  ; Remove files
  RMDir /r "$INSTDIR"
SectionEnd

Function LaunchApp
  ExecShell "open" "$INSTDIR\start-app.bat" "" SW_SHOWMINIMIZED
FunctionEnd

Function EnableAutoStart
  CreateShortCut "$SMSTARTUP\Teacher Assistant.lnk" "$INSTDIR\start-app.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWMINIMIZED "" "Launch Teacher Assistant on Windows startup"
FunctionEnd
