' Teacher Assistant - Silent Launcher
' Starts start-app.bat hidden without showing a command prompt window.
Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
BatPath = ScriptDir & "\start-app.bat"

If FSO.FileExists(BatPath) Then
    WshShell.Run """" & BatPath & """", 0, False
Else
    MsgBox "Could not find start-app.bat in " & ScriptDir, 16, "Teacher Assistant"
End If
