Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = currentDir & "\NativeGymScanner.exe"
WshShell.CurrentDirectory = currentDir
WshShell.Run """" & exePath & """", 0, False
Set WshShell = Nothing
Set fso = Nothing
