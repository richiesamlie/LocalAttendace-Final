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
  IfFileExists "$INSTDIR\TeacherAssistant.exe" 0 +3
    CreateShortCut "$DESKTOP\Teacher Assistant.lnk" "$INSTDIR\TeacherAssistant.exe" "" "$INSTDIR\TeacherAssistant.exe" 0 SW_SHOWNORMAL "" "Launch Teacher Assistant"
    Goto +2
    CreateShortCut "$DESKTOP\Teacher Assistant.lnk" "$INSTDIR\start-app.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWMINIMIZED "" "Launch Teacher Assistant"
  CreateShortCut "$DESKTOP\Stop Teacher Assistant.lnk" "$INSTDIR\stop-app.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWNORMAL "" "Stop Teacher Assistant"

  ; Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\Teacher Assistant"
  IfFileExists "$INSTDIR\TeacherAssistant.exe" 0 +3
    CreateShortCut "$SMPROGRAMS\Teacher Assistant\Teacher Assistant.lnk" "$INSTDIR\TeacherAssistant.exe" "" "$INSTDIR\TeacherAssistant.exe" 0 SW_SHOWNORMAL "" "Launch Teacher Assistant"
    Goto +2
    CreateShortCut "$SMPROGRAMS\Teacher Assistant\Teacher Assistant.lnk" "$INSTDIR\start-app.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWMINIMIZED "" "Launch Teacher Assistant"

  IfFileExists "$INSTDIR\TeacherAssistant.exe" 0 +3
    CreateShortCut "$SMPROGRAMS\Teacher Assistant\Teacher Assistant (Network Mode).lnk" "$INSTDIR\TeacherAssistant.exe" "--network" "$INSTDIR\TeacherAssistant.exe" 0 SW_SHOWNORMAL "" "Launch Teacher Assistant in Network Mode"
    Goto +2
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
  ; 1. Terminate any running instances of Teacher Assistant or Node.js in $INSTDIR
  nsExec::Exec 'cmd.exe /c "taskkill /F /IM TeacherAssistant.exe /T >nul 2>&1"'
  nsExec::Exec 'powershell.exe -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } } catch {}; Get-Process -Name node,TeacherAssistant -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like \"$INSTDIR*\" } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }"'
  Sleep 1000

  ; 2. Remove startup shortcut if enabled
  Delete "$SMSTARTUP\Teacher Assistant.lnk"

  ; 3. Remove shortcuts
  Delete "$DESKTOP\Teacher Assistant.lnk"
  Delete "$DESKTOP\Stop Teacher Assistant.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Teacher Assistant.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Teacher Assistant (Network Mode).lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Stop Teacher Assistant.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Enable Autostart on Boot.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Disable Autostart on Boot.lnk"
  Delete "$SMPROGRAMS\Teacher Assistant\Uninstall Teacher Assistant.lnk"
  RMDir "$SMPROGRAMS\Teacher Assistant"

  ; 4. Remove registry keys
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TeacherAssistant"
  DeleteRegKey HKCU "Software\TeacherAssistant"

  ; 5. Prompt to keep or remove attendance database
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to completely remove your database and attendance data?$\n$\nSelect 'Yes' to remove all data.$\nSelect 'No' to keep database.sqlite as a backup." IDNO KeepDatabase

  RMDir /r "$INSTDIR"
  Goto FinishUninstall

KeepDatabase:
  RMDir /r "$INSTDIR\dist"
  RMDir /r "$INSTDIR\dist-server"
  RMDir /r "$INSTDIR\node"
  RMDir /r "$INSTDIR\node_modules"
  RMDir /r "$INSTDIR\public"
  RMDir /r "$INSTDIR\scripts"
  Delete "$INSTDIR\TeacherAssistant.exe"
  Delete "$INSTDIR\*.bat"
  Delete "$INSTDIR\*.sh"
  Delete "$INSTDIR\*.vbs"
  Delete "$INSTDIR\*.ps1"
  Delete "$INSTDIR\*.md"
  Delete "$INSTDIR\*.txt"
  Delete "$INSTDIR\*.log"
  Delete "$INSTDIR\package.json"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

FinishUninstall:
SectionEnd

Function LaunchApp
  IfFileExists "$INSTDIR\TeacherAssistant.exe" 0 +3
    Exec "$INSTDIR\TeacherAssistant.exe"
    Return
  ExecShell "open" "$INSTDIR\start-app.bat" "" SW_SHOWMINIMIZED
FunctionEnd

Function EnableAutoStart
  IfFileExists "$INSTDIR\TeacherAssistant.exe" 0 +3
    CreateShortCut "$SMSTARTUP\Teacher Assistant.lnk" "$INSTDIR\TeacherAssistant.exe" "--startup" "$INSTDIR\TeacherAssistant.exe" 0 SW_SHOWNORMAL "" "Launch Teacher Assistant in system tray on Windows startup"
    Return
  CreateShortCut "$SMSTARTUP\Teacher Assistant.lnk" "$INSTDIR\start-app.bat" "" "$INSTDIR\public\icon.ico" 0 SW_SHOWMINIMIZED "" "Launch Teacher Assistant on Windows startup"
FunctionEnd
