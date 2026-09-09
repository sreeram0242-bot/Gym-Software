@echo off
color 0B
title GymFlow Native Scanner Agent (MFS100)

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"
cd /d "%DIR%"

echo =======================================================
echo     GYMFLOW - MANTRA NATIVE AGENT (MFS100)
echo =======================================================
echo.

echo [1/3] Terminating old agent...
taskkill /F /IM GymScannerAgent.exe >nul 2>&1
taskkill /F /IM NativeGymScanner.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Compiling Native C# Scanner...
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /out:NativeGymScanner.exe /reference:MANTRA.MFS100.dll NativeGymScanner.cs
if %errorlevel% neq 0 (
    echo [!] Compilation failed!
    pause
    exit /b %errorlevel%
)
echo Compilation successful!

echo [3/3] Starting Native Agent...
echo.
NativeGymScanner.exe
timeout /t 2 >nul
