' Teacher Assistant - Silent Launcher
' Starts start-app.bat minimized/hidden without showing a persistent command window.
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
AppDir = FSO.GetParentFolderName(FSO.GetParentFolderName(ScriptDir))

BatPath = AppDir & "\start-app.bat"
If Not FSO.FileExists(BatPath) Then
    BatPath = ScriptDir & "\..\start-app.bat"
End If

If FSO.FileExists(BatPath) Then
    WshShell.Run """" & BatPath & """", 0, False
Else
    MsgBox "Could not find start-app.bat in " & AppDir, 16, "Teacher Assistant"
End If
