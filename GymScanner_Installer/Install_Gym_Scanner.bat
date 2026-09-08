@echo off
color 0A
title GymFlow - Scanner One-Click Setup

:: Store the folder this .bat lives in as a permanent variable
set "INSTALLER_DIR=%~dp0"
:: Remove trailing backslash
set "INSTALLER_DIR=%INSTALLER_DIR:~0,-1%"

echo =======================================================
echo     GYMFLOW - MANTRA SCANNER ONE-CLICK INSTALLER
echo =======================================================
echo.
echo Installer folder: %INSTALLER_DIR%
echo.

:: ---- STEP 1: Driver ----
echo [1/3] Installing Mantra Driver...
echo Please click Next or Install on the popup window that appears.
echo.
if exist "%INSTALLER_DIR%\MFS100Driver.exe" (
    start /wait "" "%INSTALLER_DIR%\MFS100Driver.exe"
    echo Driver installation complete.
) else (
    echo [WARNING] MFS100Driver.exe not found! Skipping.
)

echo.

:: ---- STEP 2: RD Service ----
echo [2/3] Installing Mantra RD Service...
echo Please click Next or Install on the popup window that appears.
echo.
if exist "%INSTALLER_DIR%\MFS100RDService.exe" (
    start /wait "" "%INSTALLER_DIR%\MFS100RDService.exe"
    echo RD Service installation complete.
) else (
    echo [WARNING] MFS100RDService.exe not found! Skipping.
)

echo.

:: ---- STEP 3: GymFlow Agent ----
echo [3/3] Setting up GymFlow Background Agent...
echo.

:: Kill any existing running instance first (prevents port 8765 conflict)
echo Stopping any existing scanner agent...
taskkill /F /IM GymScannerAgent.exe >nul 2>&1
timeout /t 2 /nobreak >nul

if exist "%INSTALLER_DIR%\GymScannerAgent.exe" (
    copy /Y "%INSTALLER_DIR%\GymScannerAgent.exe" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\GymScannerAgent.exe" >nul
    echo Agent added to Windows Startup folder - it will run on every PC boot.
    echo Starting the agent now silently in the background...
    start "" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\GymScannerAgent.exe"
    echo Done! Agent is running.
) else (
    echo [ERROR] GymScannerAgent.exe not found in: %INSTALLER_DIR%
)

echo.
echo =======================================================
echo  ALL DONE! Close this window and start using the scanner.
echo =======================================================
pause
