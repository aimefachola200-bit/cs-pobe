#!/usr/bin/env bash
# ============================================================================
#  CS Pobè — lancement en local
#
#  Rendez ce fichier exécutable une fois :   chmod +x demarrer.sh
#  Puis lancez-le :                          ./demarrer.sh
#
#  Il démarre un petit serveur sur cet ordinateur et ouvre l'application dans
#  le navigateur. Laissez le terminal ouvert tant que vous l'utilisez ;
#  Ctrl+C arrête le serveur.
# ============================================================================
set -u
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
ADRESSE="http://localhost:${PORT}/index.html"

ouvrir() {
  # Le navigateur s'ouvre une seconde après, le temps que le serveur réponde
  ( sleep 1
    if command -v xdg-open >/dev/null 2>&1; then xdg-open "$ADRESSE"
    elif command -v open >/dev/null 2>&1; then open "$ADRESSE"
    fi ) >/dev/null 2>&1 &
}

echo
echo "  CS Pobè — démarrage sur $ADRESSE"
echo "  Ctrl+C pour arrêter."
echo

if command -v node >/dev/null 2>&1; then
  echo "  Serveur : Node.js (serveur.js, sans téléchargement)"
  ouvrir
  exec node serveur.js "$PORT"
elif command -v python3 >/dev/null 2>&1; then
  echo "  Serveur : Python"
  ouvrir
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  echo "  Serveur : Python"
  ouvrir
  exec python -m http.server "$PORT"
else
  echo "  Ni Node.js ni Python n'ont été trouvés sur cet ordinateur."
  echo
  echo "  Deux solutions :"
  echo "    - installer Node.js depuis https://nodejs.org (version LTS)"
  echo "    - ou ouvrir directement index.html : l'application fonctionne,"
  echo "      mais sans installation possible sur l'écran d'accueil."
  echo
  exit 1
fi
