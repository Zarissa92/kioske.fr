#!/usr/bin/env bash
# Lance tous les tests du KiosKe, sur ce poste (jamais sur le serveur) :
#   1. tests Python (gabarits, données, galerie des blocs) ;
#   2. build local sans réseau (bin/build_site.py --simple) ;
#   3. tests du JavaScript dans jsdom, sur les pages construites dans build/.
# Usage : bash tests/lancer.sh            (tout)
#         bash tests/lancer.sh --sans-build   (garde le build/ déjà là)
# Première fois : cd tests && npm install   (installe jsdom dans tests/node_modules/, hors git)
set -u

TESTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RACINE="$(dirname "$TESTS")"
PYTHON="$RACINE/venv_blog/bin/python"
[[ -x "$PYTHON" ]] || PYTHON="$RACINE/venv/bin/python"
[[ -x "$PYTHON" ]] || { echo "Aucun venv trouvé (venv_blog/ ou venv/)" >&2; exit 2; }
command -v node >/dev/null || { echo "node est introuvable : il faut Node.js pour les tests du JavaScript" >&2; exit 2; }
[[ -d "$TESTS/node_modules/jsdom" ]] || { echo "jsdom manque : lance « cd tests && npm install »" >&2; exit 2; }

echecs=0

echo "== Syntaxe des fichiers JavaScript"
for fichier in "$RACINE"/kioske/js/*.js "$RACINE"/static/*.js; do
    node --check "$fichier" || { echo "  ÉCHEC $fichier"; echecs=$((echecs + 1)); }
done

echo "== Tests Python"
( cd "$RACINE" && "$PYTHON" -m unittest -q tests.test_python 2>&1 | sed 's/^/  /'; exit "${PIPESTATUS[0]}" ) || echecs=$((echecs + 1))

if [[ "${1:-}" != "--sans-build" ]]; then
    echo "== Build local (--simple, sans réseau)"
    ( cd "$RACINE" && "$PYTHON" bin/build_site.py --simple 2>&1 | tail -n 3 | sed 's/^/  /'; exit "${PIPESTATUS[0]}" ) \
        || { echo "Le build a échoué : tests du JavaScript non lancés" >&2; exit 1; }
fi

for fichier in "$TESTS"/test_*.js; do
    node "$fichier" || echecs=$((echecs + 1))
done

echo
if (( echecs )); then
    echo "DES ÉCHECS ($echecs fichier(s) ou étape(s))"
    exit 1
fi
echo "TOUT EST BON"
