@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 ou superieur est necessaire. Installer Node.js avant de continuer.
  pause
  exit /b 1
)
echo.
echo BUS SCOLAIRE V3 -- PROTOTYPE LOCAL
 echo Navigateur : http://127.0.0.1:4173/
echo Pour fermer le serveur, appuyer sur Ctrl+C.
echo.
start "" "http://127.0.0.1:4173/"
node server.mjs
pause
