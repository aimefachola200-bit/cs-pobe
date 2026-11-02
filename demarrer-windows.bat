@echo off
REM ===========================================================================
REM  CS Pobe - lancement en local
REM
REM  Double-cliquez sur ce fichier. Il demarre un petit serveur sur cet
REM  ordinateur, puis ouvre l'application dans votre navigateur.
REM  Laissez cette fenetre noire ouverte tant que vous utilisez l'application.
REM ===========================================================================
setlocal
cd /d "%~dp0"
set PORT=8080

echo.
echo   CS Pobe - demarrage...
echo.

REM --- On essaie Node.js, puis Python : le premier disponible fait l'affaire
where node >nul 2>nul
if %errorlevel%==0 (
    echo   Serveur : Node.js
    start "" http://localhost:%PORT%/index.html
    node serveur.js %PORT%
    goto :fin
)

where python >nul 2>nul
if %errorlevel%==0 (
    echo   Serveur : Python
    start "" http://localhost:%PORT%/index.html
    python -m http.server %PORT%
    goto :fin
)

where py >nul 2>nul
if %errorlevel%==0 (
    echo   Serveur : Python
    start "" http://localhost:%PORT%/index.html
    py -m http.server %PORT%
    goto :fin
)

echo   Ni Node.js ni Python n'ont ete trouves sur cet ordinateur.
echo.
echo   Deux solutions :
echo     - installer Node.js depuis https://nodejs.org (version LTS)
echo     - ou ouvrir directement index.html par double-clic : l'application
echo       fonctionne, mais sans installation possible sur l'ecran d'accueil.
echo.
pause

:fin
endlocal
